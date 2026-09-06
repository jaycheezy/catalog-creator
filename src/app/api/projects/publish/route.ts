import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { sanitizeProjectId } from "@/lib/catalogProject";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { validateCatalog } from "@/lib/catalogValidation";
import {
  blankPublicationRecord,
  buildPublicationSnapshot,
  type CatalogPublicationRecord,
  type PublicationAttempt,
} from "@/lib/catalogPublication";
import { getPublicationRecord, savePublicationRecord } from "@/lib/catalogPublicationStore";
import { DurableStorageError, durableStorageMessage } from "@/lib/durableStorage";

export const runtime = "nodejs";

function failedAttempt(revision: number, code: string, message: string): PublicationAttempt {
  return {
    status: "failed",
    attemptedRevision: revision,
    attemptedAt: Date.now(),
    error: { message: message.slice(0, 300), code, retryable: false },
  };
}

/** Record a failed attempt without replacing the active snapshot. */
async function persistFailure(projectId: string, attempt: PublicationAttempt): Promise<void> {
  try {
    const current: CatalogPublicationRecord = (await getPublicationRecord(projectId)) ?? blankPublicationRecord(projectId);
    await savePublicationRecord({ ...current, lastAttempt: attempt });
  } catch (error) {
    console.error(JSON.stringify({ event: "publication_attempt_persist_failed", projectId, code: "PUBLICATION_ATTEMPT_PERSIST_FAILED" }));
    void error;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Not signed in — POST /api/login first", loginRequired: true }, { status: 401 });
  }
  let body: { id?: string; expectedRevision?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = sanitizeProjectId(body.id);
  if (!id) return NextResponse.json({ error: "Invalid or missing project id" }, { status: 400 });

  let project;
  try {
    project = await getCatalogProject(id);
  } catch (error) {
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "publication_project_read_failed", projectId: id, code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const currentRevision = project.revision ?? 0;
  if (body.expectedRevision !== undefined && body.expectedRevision !== currentRevision) {
    return NextResponse.json({
      error: "This project changed in another session. Reload it before publishing.",
      code: "REVISION_CONFLICT",
      retryable: false,
      revision: currentRevision,
    }, { status: 409 });
  }

  // Preparation runs entirely before the authoritative write: any rejection
  // below preserves the prior active snapshot byte-for-byte.
  if (!project.importStatus.complete) {
    const attempt = failedAttempt(currentRevision, "INCOMPLETE_IMPORT", "The import is incomplete. Finish importing every product before publishing.");
    await persistFailure(id, attempt);
    return NextResponse.json({ error: attempt.error?.message ?? "Publication failed.", code: attempt.error?.code ?? "PUBLICATION_FAILED", retryable: false, attempt }, { status: 422 });
  }
  if (!project.products.length) {
    const attempt = failedAttempt(currentRevision, "EMPTY_CATALOG", "There are no products to publish yet.");
    await persistFailure(id, attempt);
    return NextResponse.json({ error: attempt.error?.message ?? "Publication failed.", code: attempt.error?.code ?? "PUBLICATION_FAILED", retryable: false, attempt }, { status: 422 });
  }
  if (!project.template?.layers || !project.template.width || !project.template.height) {
    const attempt = failedAttempt(currentRevision, "INVALID_TEMPLATE", "The saved design is incomplete. Save the design before publishing.");
    await persistFailure(id, attempt);
    return NextResponse.json({ error: attempt.error?.message ?? "Publication failed.", code: attempt.error?.code ?? "PUBLICATION_FAILED", retryable: false, attempt }, { status: 422 });
  }
  const validation = validateCatalog(project.products, { importComplete: project.importStatus.complete });
  if (validation.status === "blocked") {
    const codes = [...new Set(validation.issues.map((issue) => issue.code))].join(", ");
    const attempt = failedAttempt(
      currentRevision,
      "VALIDATION_BLOCKED",
      `The catalog has blocking issues (${validation.errorCount}): ${codes}. Fix them in the source or design, then publish again.`,
    );
    await persistFailure(id, attempt);
    return NextResponse.json({
      error: attempt.error?.message ?? "Publication failed.",
      code: attempt.error?.code ?? "PUBLICATION_FAILED",
      retryable: false,
      attempt,
      validation: { status: validation.status, errorCount: validation.errorCount, warningCount: validation.warningCount },
    }, { status: 422 });
  }

  const now = Date.now();
  const snapshot = buildPublicationSnapshot(project, validation, now);
  const record: CatalogPublicationRecord = {
    schemaVersion: 1,
    projectId: id,
    active: snapshot,
    lastAttempt: { status: "success", attemptedRevision: currentRevision, attemptedAt: now },
  };
  try {
    await savePublicationRecord(record);
  } catch (error) {
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "publication_save_failed", projectId: id, code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }

  const placements = [
    { sizeId: snapshot.template.sizeId, templateId: snapshot.template.id, templateRevision: snapshot.template.revision ?? 0, width: snapshot.template.width, height: snapshot.template.height },
    ...Object.entries(snapshot.placementTemplates ?? {}).map(([sizeId, saved]) => ({
      sizeId,
      templateId: saved.id,
      templateRevision: saved.revision ?? 0,
      width: saved.width,
      height: saved.height,
    })),
  ];
  return NextResponse.json({
    ok: true,
    id,
    projectRevision: currentRevision,
    publishedAt: now,
    feedUrl: `/api/feed?projectId=${id}`,
    placements,
    validation: { status: validation.status, errorCount: validation.errorCount, warningCount: validation.warningCount },
    attempt: record.lastAttempt,
  });
}
