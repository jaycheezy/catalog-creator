import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { normalizeDomain } from "@/lib/shopify";
import { renderTemplateElement } from "@/editor/renderElement";
import { canvasBox } from "@/editor/renderStyles";
import { interFonts } from "@/editor/fonts";
import { getClientIp, checkRateLimit, isAuthenticated } from "@/lib/auth";
import type { Template } from "@/editor/types";
import type { FeedRow } from "@/lib/facebook";
import { fetchStoreCatalog } from "@/lib/storeCatalog";
import { ProductSelectionError, selectRenderProduct } from "@/lib/renderProduct";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { sanitizeProjectId, resolveProjectTemplate, isSizePresetId, type CatalogProject } from "@/lib/catalogProject";
import { SIZE_PRESETS } from "@/editor/types";
import {
  IMMUTABLE_CACHE_CONTROL,
  describeRenderAsset,
  productRevision as computeProductRevision,
  renderAssetEtag,
} from "@/lib/renderCache";
import { readRenderAsset, writeRenderAsset } from "@/lib/renderCacheStore";
import { DurableStorageError } from "@/lib/durableStorage";

async function fetchTemplateViaHttp(req: NextRequest, id: string): Promise<Template | null> {
  try {
    // Template reads are public (capability URL) — no auth header needed.
    const url = new URL(`/api/templates?id=${encodeURIComponent(id)}`, req.nextUrl.origin).toString();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Template;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const response = await renderRequest(req);
  // Authenticated and anonymous responses to a draft URL differ. Both must
  // bypass HTTP caches so a shared cache never substitutes one for the other.
  if (req.nextUrl.searchParams.get("draft") === "1") {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

async function renderRequest(req: NextRequest) {
  // Rate limit: 60/min per IP for render (expensive)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`render:${ip}`, 60);
  if (!rl.ok) return new Response("Rate limited — 60 renders/min per IP", { status: 429, headers: { "Retry-After": "60" } });

  const { searchParams } = req.nextUrl;
  const templateId = searchParams.get("templateId") || searchParams.get("id");
  const templateParam = searchParams.get("template");
  const productId = searchParams.get("productId");
  const handle = searchParams.get("handle");
  const domain = searchParams.get("domain") || "store.gibun.at";
  const rawProjectId = searchParams.get("projectId");
  const projectId = rawProjectId ? sanitizeProjectId(rawProjectId) : null;

  if (rawProjectId && !projectId) return new Response("Invalid ?projectId= parameter", { status: 400 });

  if (productId !== null ? !productId.trim() : !handle) {
    return new Response("Missing or empty ?productId= parameter", { status: 400 });
  }

  // Versioned project renders name an immutable asset and are served from
  // RENDERS_BUCKET. All three versioned parameters must travel together.
  const sizeId = searchParams.get("sizeId");
  const requestedProductRevision = searchParams.get("productRevision");
  const requestedTemplateRevision = searchParams.get("templateRevision");
  const wantsDraft = searchParams.get("draft") === "1" && (await isAuthenticated(req));
  if (sizeId !== null || requestedProductRevision !== null || requestedTemplateRevision !== null) {
    return versionedProjectRender({
      templateId, productId, projectId, sizeId, requestedProductRevision, requestedTemplateRevision, wantsDraft,
    });
  }

  // Public by design — Meta fetches server-to-server and can't log in.
  // Template IDs are unguessable capability URLs. Anonymous project reads
  // serve the published snapshot; the owner previews drafts with ?draft=1.

  let projectProducts: FeedRow[] | null = null;
  let projectTemplate: Template | null = null;
  let projectPlacements: Pick<CatalogProject, "placementTemplates">["placementTemplates"];
  if (projectId) {
    if (wantsDraft) {
      const project = await getCatalogProject(projectId);
      if (!project) return new Response(`Project not found: ${projectId}`, { status: 404 });
      projectProducts = project.products;
      projectTemplate = project.template;
      projectPlacements = project.placementTemplates;
    } else {
      let record;
      try {
        record = await getPublicationRecord(projectId);
      } catch (error) {
        if (error instanceof DurableStorageError) {
          return new Response("Published render unavailable: durable storage failed. Retry the request.", { status: 503 });
        }
        throw error;
      }
      if (!record?.active) return new Response("Project render is not published yet. Publish it from the editor first.", { status: 404 });
      projectProducts = record.active.products;
      projectTemplate = record.active.template;
      projectPlacements = record.active.placementTemplates;
    }
  }

  let template: Template | null = projectTemplate;
  const projectSource = projectTemplate ? { template: projectTemplate, placementTemplates: projectPlacements } : null;
  if (projectId && templateId && !(projectSource && resolveProjectTemplate(projectSource, templateId))) {
    return new Response(`Template does not belong to project: ${templateId}`, { status: 404 });
  } else if (projectId && templateId && projectSource) {
    template = resolveProjectTemplate(projectSource, templateId);
  } else if (!projectId && templateParam) {
    try {
      const json = Buffer.from(templateParam, "base64").toString("utf-8");
      template = JSON.parse(json) as Template;
    } catch {}
  } else if (!projectId && templateId) {
    template = await fetchTemplateViaHttp(req, templateId);
  }

  if (!template) {
    return new Response(`Template not found: ${templateId ?? "(no id)"}. POST it to /api/templates first.`, { status: 404 });
  }

  let origin = "";
  if (!projectId) {
    try {
      origin = normalizeDomain(domain);
    } catch {
      return new Response(`Invalid domain: ${domain}`, { status: 400 });
    }
  }

  let product: FeedRow;
  try {
    const rows = projectProducts ?? (await fetchStoreCatalog(origin)).rows;
    product = selectRenderProduct(rows, { productId, handle });
  } catch (e) {
    if (e instanceof ProductSelectionError) return new Response(e.message, { status: e.status });
    return new Response(`Failed to fetch product ${productId ?? handle}: ${String(e)}`, { status: 502 });
  }

  const canvas = canvasBox(template, 1);
  const width = canvas.width;
  const height = canvas.height;

  const jsx = renderTemplateElement(template, product);

  // Bundled Inter data (no per-render network fetch). Weights 400/600/700
  // cover the editor's weight options; 800 renders with the 700 face.
  return new ImageResponse(jsx, {
    width,
    height,
    fonts: interFonts(),
    headers: {
      "Cache-Control": wantsDraft ? "private, no-store" : "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

type VersionedRenderQuery = {
  templateId: string | null;
  productId: string | null;
  projectId: string | null;
  sizeId: string | null;
  requestedProductRevision: string | null;
  requestedTemplateRevision: string | null;
  wantsDraft: boolean;
};

type VersionedRenderSource = {
  projectId: string;
  products: FeedRow[];
  template: Template;
  placementTemplates: CatalogProject["placementTemplates"];
};

/**
 * A previously rendered public URL remains useful after a later publication
 * removes its product or template. Its complete immutable identity is already
 * present in the query, so only an exact cache hit may be served; a miss falls
 * through to the current-snapshot error.
 */
async function readSupersededRender(query: VersionedRenderQuery): Promise<Response | null> {
  if (
    query.wantsDraft ||
    !query.projectId ||
    !query.templateId ||
    !query.productId ||
    !query.requestedProductRevision ||
    !query.requestedTemplateRevision ||
    !query.sizeId ||
    !isSizePresetId(query.sizeId)
  ) return null;

  const preset = SIZE_PRESETS.find((candidate) => candidate.id === query.sizeId);
  if (!preset) return null;
  const descriptor = describeRenderAsset({
    projectId: query.projectId,
    productId: query.productId,
    sizeId: query.sizeId,
    productRevision: query.requestedProductRevision,
    templateId: query.templateId,
    templateRevision: Number(query.requestedTemplateRevision),
    width: preset.width,
    height: preset.height,
  });

  let cached;
  try {
    cached = await readRenderAsset(descriptor);
  } catch (error) {
    if (error instanceof DurableStorageError) {
      return new Response(`Render storage unavailable: ${error.message} Retry the request.`, {
        status: 503,
        headers: { "Retry-After": "30" },
      });
    }
    throw error;
  }
  if (cached.kind === "unavailable") {
    return new Response("Render storage unavailable: the RENDERS_BUCKET binding is missing. Retry the request.", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
  if (cached.kind !== "hit") return null;
  return new Response(cached.bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      ETag: cached.etag,
      "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      "X-Render-Cache": "hit-stale",
    },
  });
}

/**
 * Serve one immutable project render asset. Validates the bounded query,
 * loads the chosen source once (draft for explicit owner previews, otherwise
 * the frozen publication snapshot — never upstream sources), verifies both
 * requested revisions, and serves stored bytes on a cache hit. A miss
 * renders exactly the verified revision and stores it before returning.
 */
async function versionedProjectRender(query: VersionedRenderQuery): Promise<Response> {
  if (!query.projectId) return new Response("Versioned renders require ?projectId=.", { status: 400 });
  if (!query.templateId) return new Response("Versioned renders require ?templateId=.", { status: 400 });
  if (!query.productId?.trim() || query.productId.length > 200) {
    return new Response("Invalid ?productId= parameter.", { status: 400 });
  }
  if (!query.sizeId || !isSizePresetId(query.sizeId)) {
    return new Response("Invalid ?sizeId= parameter. Expected 1:1, 4:5, 9:16, or 1.91:1.", { status: 400 });
  }
  if (!query.requestedProductRevision || !/^[0-9a-f]{16}$/.test(query.requestedProductRevision)) {
    return new Response("Invalid ?productRevision= parameter.", { status: 400 });
  }
  if (!query.requestedTemplateRevision || !/^\d{1,10}$/.test(query.requestedTemplateRevision)) {
    return new Response("Invalid ?templateRevision= parameter.", { status: 400 });
  }

  let source: VersionedRenderSource;
  if (query.wantsDraft) {
    const project = await getCatalogProject(query.projectId);
    if (!project) return new Response(`Project not found: ${query.projectId}`, { status: 404 });
    source = { projectId: project.id, products: project.products, template: project.template, placementTemplates: project.placementTemplates };
  } else {
    let record;
    try {
      record = await getPublicationRecord(query.projectId);
    } catch (error) {
      if (error instanceof DurableStorageError) {
        return new Response("Published render unavailable: durable storage failed. Retry the request.", { status: 503 });
      }
      throw error;
    }
    if (!record?.active) return new Response("Project render is not published yet. Publish it from the editor first.", { status: 404 });
    source = {
      projectId: record.active.projectId,
      products: record.active.products,
      template: record.active.template,
      placementTemplates: record.active.placementTemplates,
    };
  }
  const template = resolveProjectTemplate(source, query.templateId);
  if (!template) {
    const historical = await readSupersededRender(query);
    if (historical) return historical;
    return new Response(`Template does not belong to project: ${query.projectId}`, { status: 404 });
  }
  const placementMismatch = template.sizeId !== query.sizeId;

  let product: FeedRow;
  try {
    product = selectRenderProduct(source.products, { productId: query.productId, handle: null });
  } catch (e) {
    const historical = await readSupersededRender(query);
    if (historical) return historical;
    if (e instanceof ProductSelectionError) return new Response(e.message, { status: e.status });
    return new Response(`Product not found: ${query.productId}`, { status: 404 });
  }

  const actualProductRevision = await computeProductRevision(product);
  const actualTemplateRevision = template.revision ?? 0;
  if (actualProductRevision !== query.requestedProductRevision || actualTemplateRevision !== Number(query.requestedTemplateRevision) || placementMismatch) {
    // A superseded but previously published URL keeps serving its stored
    // bytes: the R2 key is fully determined by the request, so a hit can
    // only ever return the exact immutable asset once issued. Anything else
    // is a dead link.
    const historical = await readSupersededRender(query);
    if (historical) return historical;
    if (placementMismatch) {
      return new Response(
        `Placement mismatch: template ${template.id} is ${template.sizeId}, requested ${query.sizeId}. Refresh the feed for the current link.`,
        { status: 409 },
      );
    }
    if (actualProductRevision !== query.requestedProductRevision) {
      return new Response(
        "Stale product revision: the catalog changed since this image URL was issued. Refresh the feed for the current link.",
        { status: 409 },
      );
    }
    return new Response(
      "Stale template revision: the design changed since this image URL was issued. Refresh the feed for the current link.",
      { status: 409 },
    );
  }

  const descriptor = describeRenderAsset({
    projectId: source.projectId,
    productId: product.source_id || product.id,
    sizeId: query.sizeId,
    productRevision: actualProductRevision,
    templateId: template.id,
    templateRevision: actualTemplateRevision,
    width: template.width,
    height: template.height,
  });
  const etag = renderAssetEtag(descriptor);
  if (query.wantsDraft) {
    const rendered = await new ImageResponse(renderTemplateElement(template, product), {
      width: template.width,
      height: template.height,
      fonts: interFonts(),
    });
    return new Response(await rendered.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        ETag: etag,
        "X-Render-Cache": "bypass-draft",
      },
    });
  }
  let cached;
  try {
    cached = await readRenderAsset(descriptor);
  } catch (error) {
    if (error instanceof DurableStorageError) {
      return new Response(`Render storage unavailable: ${error.message} Retry the request.`, {
        status: 503,
        headers: { "Retry-After": "30" },
      });
    }
    throw error;
  }
  if (cached.kind === "unavailable") {
    return new Response("Render storage unavailable: the RENDERS_BUCKET binding is missing. Retry the request.", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
  if (cached.kind === "hit") {
    return new Response(cached.bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        ETag: cached.etag,
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
        "X-Render-Cache": "hit",
      },
    });
  }

  const rendered = await new ImageResponse(renderTemplateElement(template, product), {
    width: template.width,
    height: template.height,
    fonts: interFonts(),
  });
  const bytes = new Uint8Array(await rendered.arrayBuffer());
  try {
    await writeRenderAsset(descriptor, bytes, etag);
  } catch {
    console.error(JSON.stringify({ event: "render_cache_write_failed", code: "RENDER_CACHE_WRITE_FAILED" }));
    // Serve the freshly rendered bytes with a short cache policy instead of
    // failing a correct render or claiming immutable caching.
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        ETag: etag,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        "X-Render-Cache": "miss-write-failed",
      },
    });
  }
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      ETag: etag,
      "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      "X-Render-Cache": "miss",
    },
  });
}
