import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/shopify";
import { rowsToCsv } from "@/lib/facebook";
import { getClientIp, checkRateLimit, isAuthenticated } from "@/lib/auth";
import { fetchStoreCatalog } from "@/lib/storeCatalog";
import { buildRenderUrl } from "@/lib/renderProduct";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { sanitizeProjectId, resolveProjectTemplate, isSizePresetId } from "@/lib/catalogProject";
import type { CatalogProject } from "@/lib/catalogProject";
import type { FeedRow } from "@/lib/facebook";
import type { Template } from "@/editor/types";
import { productRevision } from "@/lib/renderCache";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { DurableStorageError } from "@/lib/durableStorage";
import { validateCatalog, type CatalogValidationResult } from "@/lib/catalogValidation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const response = await generateFeed(req);
  // This URL depends on the caller's session even when an anonymous caller
  // falls back to the publication. Never cache either response at a shared URL.
  if (req.nextUrl.searchParams.get("draft") === "1") {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

async function generateFeed(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") || req.nextUrl.searchParams.get("store") || "";
  const rawProjectId = req.nextUrl.searchParams.get("projectId");
  const projectId = rawProjectId ? sanitizeProjectId(rawProjectId) : null;

  if (rawProjectId && !projectId) {
    return new NextResponse("Invalid ?projectId= parameter\n", { status: 400 });
  }
  if (!domain && !projectId) {
    return new NextResponse(
      "Missing ?domain= or ?projectId= parameter.\n",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  let origin = "";
  if (!projectId) {
    try {
      origin = normalizeDomain(domain);
    } catch {
      return new NextResponse(`Invalid domain: ${domain}\n`, { status: 400 });
    }
  }

  let templateId = req.nextUrl.searchParams.get("templateId") || req.nextUrl.searchParams.get("template_id");

  // Rate limit plain preview/feed too (30/min)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`feed:${ip}`, 30);
  if (!rl.ok) return new NextResponse("Rate limited — 30 feed requests/min per IP", { status: 429, headers: { "Retry-After": "60" } });

  let project: CatalogProject | null = null;
  let draftPreview = false;
  // Anonymous project reads serve the published snapshot only; saving a
  // draft never changes public output. The owner previews drafts explicitly
  // with an authenticated ?draft=1 request, never a shared feed URL.
  let snapshotProducts: FeedRow[] | null = null;
  let snapshotTemplate: Template | null = null;
  let snapshotPlacements: CatalogProject["placementTemplates"] = undefined;
  let snapshotValidation: CatalogValidationResult | null = null;
  let snapshotName = "";
  let snapshotTotals = { totalProducts: 0, totalRows: 0 };
  if (projectId) {
    draftPreview = req.nextUrl.searchParams.get("draft") === "1" && (await isAuthenticated(req));
    if (draftPreview) {
      project = await getCatalogProject(projectId);
      if (!project) return new NextResponse(`Project not found: ${projectId}\n`, { status: 404 });
      if (templateId && !resolveProjectTemplate(project, templateId)) {
        return new NextResponse(`Template does not belong to project: ${templateId}\n`, { status: 404 });
      }
      templateId = templateId || project.template.id;
    } else {
      let record;
      try {
        record = await getPublicationRecord(projectId);
      } catch (error) {
        if (error instanceof DurableStorageError) {
          return new NextResponse("Published feed unavailable: durable storage failed. Retry the request.\n", { status: 503 });
        }
        throw error;
      }
      if (!record?.active) {
        return new NextResponse(`Project feed is not published yet. Publish it from the editor first.\n`, { status: 404 });
      }

      const active = record.active;
      if (templateId && !resolveProjectTemplate(active, templateId)) {
        return new NextResponse(`Template does not belong to project: ${templateId}\n`, { status: 404 });
      }
      templateId = templateId || active.template.id;
      snapshotProducts = active.products;
      snapshotTemplate = active.template;
      snapshotPlacements = active.placementTemplates;
      snapshotValidation = active.validation;
      snapshotName = active.name;
      snapshotTotals = { totalProducts: active.importStatus.totalProducts, totalRows: active.products.length };
    }
  } else if (templateId) {
    // Enriched feeds are public capability URLs because Meta cannot log in.
    try {
      const { getTemplate } = await import("@/lib/templateStore");
      const t = await getTemplate(templateId);
      if (!t) {
        return new NextResponse(`Template not found: ${templateId}. POST it to /api/templates first.\n`, { status: 404 });
      }
    } catch {
      return new NextResponse(`Template not found: ${templateId}. POST it to /api/templates first.\n`, { status: 404 });
    }
  }

  try {
    let rows: FeedRow[];
    let totalProducts: number;
    let validation: CatalogValidationResult;
    // Draft reads (owner preview) and published reads share the CSV builder;
    // only the source differs. Anonymous project URLs always serve the
    // frozen publication snapshot.
    const sourceProducts = snapshotProducts ?? project?.products ?? null;
    if (sourceProducts) {
      rows = sourceProducts;
      totalProducts = snapshotProducts ? snapshotTotals.totalProducts : project!.importStatus.totalProducts;
      validation = snapshotValidation
        ?? project!.validation
        ?? validateCatalog(rows, { importComplete: project!.importStatus.complete });
    } else {
      const catalog = await fetchStoreCatalog(origin);
      rows = catalog.rows;
      totalProducts = catalog.totalProducts;
      validation = validateCatalog(rows, { importComplete: catalog.complete });
    }

    // Each image URL identifies the source variant, independently of its SKU.
    // Project feeds point at immutable versioned assets so a price, image,
    // or design change yields a new image URL instead of stale bytes.
    // Published reads resolve against the frozen snapshot, never the draft.
    if (templateId) {
      const source = snapshotTemplate
        ? { template: snapshotTemplate, placementTemplates: snapshotPlacements }
        : project;
      const resolved = source ? resolveProjectTemplate(source, templateId) : null;
      const versionedSizeId = resolved && isSizePresetId(resolved.sizeId) ? resolved.sizeId : null;
      const rendered: FeedRow[] = [];
      for (const row of rows) {
        let image_link: string;
        if (draftPreview && projectId) {
          // Draft previews must resolve against the authenticated mutable
          // project. Versioned URLs intentionally resolve against the frozen
          // publication snapshot, so use the explicit legacy draft target.
          image_link = new URL(
            buildRenderUrl(templateId, { projectId, draft: true }, row),
            req.nextUrl.origin,
          ).toString();
        } else if (projectId && resolved && versionedSizeId) {
          image_link = new URL(
            buildRenderUrl(
              resolved.id,
              {
                projectId,
                productId: row.source_id || row.id,
                sizeId: versionedSizeId,
                productRevision: await productRevision(row),
                templateRevision: resolved.revision ?? 0,
              },
              row,
            ),
            req.nextUrl.origin,
          ).toString();
        } else {
          image_link = new URL(
            buildRenderUrl(templateId, projectId ? { projectId } : origin, row),
            req.nextUrl.origin,
          ).toString();
        }
        rendered.push({ ...row, image_link });
      }
      rows = rendered;
    }

    const csv = rowsToCsv(rows);

    const filenameBase = project ? project.name : snapshotTemplate ? snapshotName || "catalog" : origin.replace(/^https?:\/\//, "");
    const filename = filenameBase.replace(/[^a-z0-9]/gi, "_") + "_facebook.csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": draftPreview
          ? "private, no-store"
          : "public, s-maxage=3600, stale-while-revalidate=600",
        "X-Total-Products": String(totalProducts),
        "X-Total-Variants": String(rows.length),
        "X-Catalog-Validation": validation.status,
        "X-Catalog-Errors": String(validation.errorCount),
        "X-Catalog-Warnings": String(validation.warningCount),
        "X-Import-Complete": String(validation.importComplete),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(`CSV generation failed: ${message}\n`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
