import type { FeedRow } from "./facebook";
import type { SizePresetId } from "./catalogProject";

export class ProductSelectionError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 409) {
    super(message);
    this.name = "ProductSelectionError";
  }
}

/** Shared by the feed and editor so every export identifies the same row. */
export type RenderCatalogTarget = string | { domain?: string; projectId?: string; draft?: boolean };

/**
 * Versioned project render target (story c-reliable-versioned-renders).
 * Names an immutable asset: exact product, placement size, product-content
 * revision, and saved placement-template revision. Kept distinct from the
 * legacy target so callers cannot accidentally mix contracts.
 */
export type VersionedProjectRenderTarget = {
  projectId: string;
  productId: string;
  sizeId: SizePresetId;
  productRevision: string;
  templateRevision: number;
};

export function buildRenderUrl(
  templateId: string,
  target: RenderCatalogTarget | VersionedProjectRenderTarget,
  product: FeedRow,
): string {
  const productId = product.source_id || product.id;
  if (!productId) throw new ProductSelectionError("Product is missing an ID", 400);
  if (isVersionedProjectRenderTarget(target)) {
    if (productId !== target.productId) {
      throw new ProductSelectionError("Versioned render target does not match the product", 400);
    }
    const params = new URLSearchParams({
      // Bypass HTTP caches populated before template identity was included
      // in the render storage key. The project feed subscription stays stable.
      assetVersion: "2",
      templateId,
      projectId: target.projectId,
      productId: target.productId,
      sizeId: target.sizeId,
      productRevision: target.productRevision,
      templateRevision: String(target.templateRevision),
    });
    return `/api/render?${params.toString()}`;
  }
  const params = new URLSearchParams({ templateId });
  if (typeof target === "string") params.set("domain", target);
  else if (target.projectId) {
    params.set("projectId", target.projectId);
    // Authenticated draft preview only; anonymous readers always see the
    // published snapshot. Never copy this flag into shared feed URLs.
    if (target.draft) params.set("draft", "1");
  } else if (target.domain) params.set("domain", target.domain);
  else throw new ProductSelectionError("Render URL needs a domain or project ID", 400);
  // Older cached previews have only the CSV ID. Send those through the legacy
  // exact/ambiguity-checked lookup until the preview supplies source metadata.
  params.set(product.source_id ? "productId" : "handle", productId);
  return `/api/render?${params.toString()}`;
}

function isVersionedProjectRenderTarget(target: RenderCatalogTarget | VersionedProjectRenderTarget): target is VersionedProjectRenderTarget {
  return typeof target === "object" && "productRevision" in target && "templateRevision" in target;
}

function matchesLegacyHandle(row: FeedRow, handle: string): boolean {
  if (row.id === handle || row.source_id === handle) return true;
  try {
    const link = new URL(row.link);
    const pathname = decodeURIComponent(link.pathname).replace(/\/$/, "");
    // Old Shopify handles and WooCommerce slugs must match a complete segment.
    if (!handle.includes("/") && pathname.split("/").pop() === handle) return true;
    const target = new URL(handle);
    return target.origin === link.origin &&
      decodeURIComponent(target.pathname).replace(/\/$/, "") === pathname &&
      (!target.search || target.search === link.search);
  } catch {
    return false;
  }
}

export function selectRenderProduct(
  rows: FeedRow[],
  selector: { productId: string | null; handle: string | null }
): FeedRow {
  const { productId, handle } = selector;
  // An explicit ID always wins, including when it is invalid. Never silently
  // fall back to a handle or another variant if the requested ID is absent.
  if (productId !== null && !productId.trim()) {
    throw new ProductSelectionError("Empty ?productId= parameter", 400);
  }
  if (productId === null && !handle) {
    throw new ProductSelectionError("Missing ?productId= parameter", 400);
  }
  const matches = productId !== null
    ? rows.filter((row) => (row.source_id || row.id) === productId)
    : rows.filter((row) => matchesLegacyHandle(row, handle!));
  if (matches.length === 0) {
    throw new ProductSelectionError(`Product not found: ${productId ?? handle}`, 404);
  }
  if (matches.length > 1) {
    throw new ProductSelectionError(
      "Product reference matches multiple variants. Refresh the feed or use a variant-specific ?productId= URL.",
      409
    );
  }
  return matches[0];
}
