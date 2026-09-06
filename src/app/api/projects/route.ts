import { NextRequest, NextResponse } from "next/server";
import type { Template } from "@/editor/types";
import { SIZE_PRESETS } from "@/editor/types";
import { isAuthenticated, newTemplateId, sanitizeTemplateId } from "@/lib/auth";
import { isSizePresetId, newProjectId, sanitizeProjectId, type CatalogProject, type CatalogProjectSource, type SizePresetId } from "@/lib/catalogProject";
import { getCatalogProject, saveCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { publicationSummary } from "@/lib/catalogPublication";
import { parseFeedCsv } from "@/lib/feedImport";
import { importRemoteFeed, MAX_FEED_BYTES } from "@/lib/remoteFeed";
import { normalizeDomain } from "@/lib/shopify";
import { fetchStoreCatalog } from "@/lib/storeCatalog";
import { saveTemplate } from "@/lib/templateStore";
import { validateCatalog } from "@/lib/catalogValidation";
import { durableStorageMessage, DurableStorageError } from "@/lib/durableStorage";

export const runtime = "nodejs";

type CreateBody = {
  source?: { type?: "store" | "feed-url" | "csv"; value?: string; csvText?: string };
  template?: Template;
  placement?: CatalogProject["placement"];
};

const placements = new Set<CatalogProject["placement"]>(["carousel", "feed", "portrait", "story"]);

function unauthorized() {
  return NextResponse.json({ error: "Not signed in — POST /api/login first", loginRequired: true }, { status: 401 });
}

function projectName(source: CatalogProjectSource): string {
  if (source.type === "csv") return source.value.replace(/\.[^.]+$/, "") || "CSV catalog";
  try {
    return new URL(source.value).hostname.replace(/^www\./, "");
  } catch {
    return "Catalog project";
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) return unauthorized();
  const id = sanitizeProjectId(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Invalid or missing project id" }, { status: 400 });
  try {
    const project = await getCatalogProject(id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const validation = project.validation ?? validateCatalog(project.products, { importComplete: project.importStatus.complete });
    // Publication status rides along so reopening restores it from the
    // server instead of inferring from local state. A null publication
    // means unknown (storage failure), not "never published".
    let publication = null;
    try {
      publication = publicationSummary(await getPublicationRecord(id));
    } catch (error) {
      console.error(JSON.stringify({ event: "publication_status_unavailable", projectId: id }));
      void error;
    }
    return NextResponse.json({ ...project, revision: project.revision ?? 0, validation, publication }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(durableStorageMessage(error), { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return unauthorized();
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.template?.layers || !body.template.width || !body.template.height || !body.source?.type) {
    return NextResponse.json({ error: "Missing source or template" }, { status: 400 });
  }

  try {
    let source: CatalogProjectSource;
    let products;
    let totalProducts: number;
    let complete = true;

    if (body.source.type === "store") {
      const origin = normalizeDomain(body.source.value || "");
      const catalog = await fetchStoreCatalog(origin);
      source = {
        type: "store",
        value: origin,
        platform: catalog.platform,
        currencyCodes: catalog.currencyCodes,
        currencySource: catalog.currencySource,
      };
      products = catalog.rows;
      totalProducts = catalog.totalProducts;
      complete = catalog.complete;
    } else if (body.source.type === "feed-url") {
      const imported = await importRemoteFeed(body.source.value || "");
      source = { type: "feed-url", value: imported.url, format: imported.format };
      products = imported.rows;
      totalProducts = imported.rows.length;
    } else {
      const csvText = body.source.csvText || "";
      if (new TextEncoder().encode(csvText).byteLength > MAX_FEED_BYTES) {
        return NextResponse.json({ error: "CSV is too large (maximum 8MB)" }, { status: 413 });
      }
      products = parseFeedCsv(csvText, body.source.value || "csv");
      source = { type: "csv", value: (body.source.value || "catalog.csv").slice(0, 200), format: "csv" };
      totalProducts = products.length;
    }

    const now = Date.now();
    const cleanTemplateId = sanitizeTemplateId(body.template.id);
    const template = {
      ...body.template,
      id: cleanTemplateId && cleanTemplateId.length >= 12 ? cleanTemplateId : newTemplateId(),
      updatedAt: now,
      revision: 1,
    };
    const project: CatalogProject = {
      id: newProjectId(),
      name: projectName(source),
      source,
      products,
      template,
      placement: placements.has(body.placement as CatalogProject["placement"]) ? body.placement! : "carousel",
      importStatus: {
        complete,
        totalProducts,
        totalRows: products.length,
        ...(!complete ? { warning: "The store reached the import safety limit; this saved snapshot may be incomplete." } : {}),
      },
      validation: validateCatalog(products, { importComplete: complete }),
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    await saveTemplate(template);
    await saveCatalogProject(project);
    return NextResponse.json({
      ok: true,
      id: project.id,
      templateId: template.id,
      totalProducts: project.importStatus.totalProducts,
      totalRows: project.importStatus.totalRows,
      complete,
      validation: project.validation,
      revision: project.revision,
      templateRevision: template.revision,
    });
  } catch (error) {
    if (error instanceof DurableStorageError) {
      const payload = durableStorageMessage(error);
      console.error(JSON.stringify({ event: "project_create_save_failed", code: payload.code }));
      return NextResponse.json(payload, { status: 503 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated(req))) return unauthorized();
  let body: {
    id?: string;
    template?: Template;
    placement?: CatalogProject["placement"];
    placementTemplates?: Partial<Record<string, Template>>;
    expectedRevision?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = sanitizeProjectId(body.id);
  if (!id) return NextResponse.json({ error: "Invalid or missing project id" }, { status: 400 });
  try {
    const project = await getCatalogProject(id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const currentRevision = project.revision ?? 0;
    if (body.expectedRevision !== undefined && body.expectedRevision !== currentRevision) {
      return NextResponse.json({
        error: "This project changed in another session. Reload it before saving again.",
        code: "REVISION_CONFLICT",
        retryable: false,
        revision: currentRevision,
      }, { status: 409 });
    }

    const now = Date.now();
    let template = project.template;
    if (body.template) {
      if (!body.template.layers || !body.template.width || !body.template.height) {
        return NextResponse.json({ error: "Invalid template" }, { status: 400 });
      }
      template = {
        ...body.template,
        id: project.template.id,
        createdAt: project.template.createdAt,
        updatedAt: now,
        revision: (project.template.revision ?? 0) + 1,
      };
    }

    // Validate every placement before writing anything: a save-all either
    // persists all placements or none. Provided keys merge into the stored
    // record so saving one variant leaves the other placements untouched.
    let placementTemplates = project.placementTemplates;
    if (body.placementTemplates !== undefined) {
      if (!body.placementTemplates || typeof body.placementTemplates !== "object" || Array.isArray(body.placementTemplates)) {
        return NextResponse.json({ error: "Invalid placement templates" }, { status: 400 });
      }
      const normalized: Partial<Record<SizePresetId, Template>> = {};
      for (const [key, incoming] of Object.entries(body.placementTemplates)) {
        if (!isSizePresetId(key)) {
          return NextResponse.json({ error: `Invalid placement size: ${key}` }, { status: 400 });
        }
        const preset = SIZE_PRESETS.find((candidate) => candidate.id === key);
        if (!preset) return NextResponse.json({ error: `Unknown placement size: ${key}` }, { status: 400 });
        if (!incoming || !Array.isArray(incoming.layers) || !incoming.width || !incoming.height) {
          return NextResponse.json({ error: `Invalid template for placement ${key}` }, { status: 400 });
        }
        if (incoming.sizeId !== key) {
          return NextResponse.json({ error: `Placement ${key} carries size ${incoming.sizeId}` }, { status: 400 });
        }
        if (incoming.width !== preset.width || incoming.height !== preset.height) {
          return NextResponse.json({
            error: `Placement ${key} must be ${preset.width}×${preset.height}, received ${incoming.width}×${incoming.height}`,
          }, { status: 400 });
        }
        // The API owns ID/revision assignment: preserve the stored placement
        // identity so links stay stable, then bump its revision.
        const existing = project.placementTemplates?.[key];
        normalized[key] = {
          ...incoming,
          id: existing?.id ?? newTemplateId(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          revision: (existing?.revision ?? 0) + 1,
        };
      }
      placementTemplates = { ...project.placementTemplates, ...normalized };
    }

    const nextProject: CatalogProject = {
      ...project,
      template,
      placementTemplates,
      placement: body.placement && placements.has(body.placement) ? body.placement : project.placement,
      updatedAt: now,
      revision: currentRevision + 1,
    };
    // The project aggregate is authoritative for every project feed/render
    // path, so it advances first: if its write fails, the legacy standalone
    // template mirror never runs and no partial state is left behind. A
    // mirror failure after a successful project write still reports an error
    // rather than claiming full success.
    await saveCatalogProject(nextProject);
    if (body.template) await saveTemplate(template);
    const variants = (Object.entries(nextProject.placementTemplates ?? {}) as [SizePresetId, Template][]).map(
      ([sizeId, saved]) => ({
        sizeId,
        templateId: saved.id,
        templateRevision: saved.revision ?? 0,
        width: saved.width,
        height: saved.height,
      }),
    );
    return NextResponse.json({
      ok: true,
      id,
      templateId: template.id,
      revision: nextProject.revision,
      templateRevision: template.revision ?? 0,
      variants,
    });
  } catch (error) {
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "project_save_failed", projectId: id, code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }
}
