import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { SIZE_PRESETS } from "@/editor/types";
import { isSizePresetId, sanitizeProjectId, type CatalogProject } from "@/lib/catalogProject";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { validateCatalog } from "@/lib/catalogValidation";
import {
  buildPublicationSnapshot,
  type CatalogPublicationRecord,
  type PublicationAttempt,
} from "@/lib/catalogPublication";
import {
  activatePublicationRecord,
  PublicationWriteConflictError,
  recordPublicationFailure,
} from "@/lib/catalogPublicationStore";
import { DurableStorageError, durableStorageMessage } from "@/lib/durableStorage";

export const runtime = "nodejs";

function failedAttempt(revision: number, code: string, message: string): PublicationAttempt & { status: "failed" } {
  return {
    status: "failed",
    attemptedRevision: revision,
    attemptedAt: Date.now(),
    error: { message: message.slice(0, 300), code, retryable: false },
  };
}

/** Record a failed attempt without replacing the active snapshot. */
async function persistFailure(projectId: string, attempt: PublicationAttempt & { status: "failed" }): Promise<void> {
  try {
    await recordPublicationFailure(projectId, attempt);
  } catch (error) {
    console.error(JSON.stringify({ event: "publication_attempt_persist_failed", code: "PUBLICATION_ATTEMPT_PERSIST_FAILED" }));
    void error;
  }
}

function publicationTemplateError(project: CatalogProject): string | null {
  const entries: [string, CatalogProject["template"]][] = [
    ["master", project.template],
    ...Object.entries(project.placementTemplates ?? {}),
  ];
  const ids = new Set<string>();
  for (const [placementKey, template] of entries) {
    if (!template || !Array.isArray(template.layers) || !template.id) {
      return `The saved ${placementKey} design is incomplete. Save it before publishing.`;
    }
    if (!isSizePresetId(template.sizeId)) {
      return `The saved ${placementKey} design has an unsupported placement size. Save it again before publishing.`;
    }
    if (placementKey !== "master" && placementKey !== template.sizeId) {
      return `The saved ${placementKey} placement contains the wrong size. Save all placements again before publishing.`;
    }
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === template.sizeId);
    if (!preset || template.width !== preset.width || template.height !== preset.height) {
      return `The saved ${placementKey} design dimensions do not match ${template.sizeId}. Save it again before publishing.`;
    }
    if (ids.has(template.id)) {
      return "Two saved placements share one template identity. Save all placements again before publishing.";
    }
    ids.add(template.id);
  }
  return null;
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
  if (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) {
    return NextResponse.json({
      error: "A valid expectedRevision is required. Reload the project before publishing.",
      code: "INVALID_EXPECTED_REVISION",
      retryable: false,
    }, { status: 400 });
  }

  let project;
  try {
    project = await getCatalogProject(id);
  } catch (error) {
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "publication_project_read_failed", code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const currentRevision = project.revision ?? 0;
  if (body.expectedRevision !== currentRevision) {
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
  const templateError = publicationTemplateError(project);
  if (templateError) {
    const attempt = failedAttempt(currentRevision, "INVALID_TEMPLATE", templateError);
    await persistFailure(id, attempt);
    return NextResponse.json({ error: attempt.error?.message ?? "Publication failed.", code: attempt.error?.code ?? "PUBLICATION_FAILED", retryable: false, attempt }, { status: 422 });
  }
  const validation = validateCatalog(project.products, { importComplete: project.importStatus.complete });
  // Default policy: publish the valid rows and skip rows with errors,
  // recording exactly what was skipped. Only a catalog with nothing
  // publishable is rejected; incomplete imports still block outright
  // because missing data cannot be distinguished from invalid data.
  const errorIndexes = new Set<number>();
  for (const issue of validation.issues) {
    if (issue.severity !== "error") continue;
    for (const index of issue.rowIndexes) errorIndexes.add(index);
  }
  const skippedIndexes = [...errorIndexes].filter((index) => index >= 0 && index < project.products.length).sort((a, b) => a - b);
  const skippedProductIds = skippedIndexes.map((index) => project.products[index]?.id || `(row ${index + 1})`);
  const skippedCodes = [...new Set(validation.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code))];
  if (skippedIndexes.length >= project.products.length) {
    const attempt = failedAttempt(
      currentRevision,
      "VALIDATION_BLOCKED",
      `Every product has blocking issues (${skippedCodes.join(", ")}). Fix them in the source or design, then publish again.`,
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
  const publishable = project.products.filter((_, index) => !errorIndexes.has(index));
  const snapshotValidation = skippedIndexes.length === 0
    ? validation
    : validateCatalog(publishable, { importComplete: project.importStatus.complete });

  const now = Date.now();
  const snapshot = buildPublicationSnapshot(
    { ...project, products: publishable },
    snapshotValidation,
    now,
    { skippedProductIds, skippedCodes },
  );
  const record: CatalogPublicationRecord = {
    schemaVersion: 1,
    projectId: id,
    active: snapshot,
    lastAttempt: {
      status: "success",
      attemptedRevision: currentRevision,
      attemptedAt: now,
      ...(skippedProductIds.length > 0 ? { skippedProductIds } : {}),
    },
  };
  let storedRecord: CatalogPublicationRecord;
  try {
    storedRecord = await activatePublicationRecord(record);
  } catch (error) {
    if (error instanceof PublicationWriteConflictError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        retryable: false,
        revision: error.currentRevision,
      }, { status: 409 });
    }
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "publication_save_failed", code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }

  const active = storedRecord.active!;
  const placements = [
    { sizeId: active.template.sizeId, templateId: active.template.id, templateRevision: active.template.revision ?? 0, width: active.template.width, height: active.template.height },
    ...Object.entries(active.placementTemplates ?? {}).map(([sizeId, saved]) => ({
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
    projectRevision: active.projectRevision,
    publishedAt: active.publishedAt,
    feedUrl: `/api/feed?projectId=${id}`,
    placements,
    publishedRows: active.products.length,
    totalRows: project.products.length,
    skipped: active.skipped,
    validation: { status: active.validation.status, errorCount: active.validation.errorCount, warningCount: active.validation.warningCount },
    attempt: storedRecord.lastAttempt,
  });
}
