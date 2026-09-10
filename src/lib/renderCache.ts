// Versioned project render assets for story c-reliable-versioned-renders.
//
// A project render URL names an immutable PNG: project, variant, product
// content, placement-template revision, placement size, and the renderer
// contract. The R2 object key derives from the same identity, so a repeated
// request reuses stored bytes while any price, image, or design change yields
// a new URL. Hashing uses `crypto.subtle`, available in the Cloudflare,
// Node.js, and test runtimes.

import type { FeedRow } from "./facebook";
import type { SizePresetId } from "./catalogProject";
import { RENDERER_CONTRACT_VERSION } from "@/editor/renderStyles";

/** R2 prefix for immutable project render assets. */
// v2 separates assets from the original key namespace, whose placement
// identity was incomplete and could collide across templates.
export const RENDER_CACHE_PREFIX = "renders/v2/";
/** Hash algorithm and hex characters kept from the product-content digest. */
export const PRODUCT_REVISION_HASH = "SHA-256";
export const PRODUCT_REVISION_LENGTH = 16;

/**
 * Normalized `FeedRow` fields that can reach a binding or image output.
 * Every normalized FeedRow field can be used by the renderer's generic
 * binding fallback, so each one participates in the immutable identity.
 */
const REVISION_FIELDS = [
  "id",
  "source_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "additional_image_link",
  "item_group_id",
  "google_product_category",
  "sale_price",
  "inventory",
] as const;

/** Canonical render-relevant snapshot: fixed key order, absent values as "". */
export function canonicalProductContent(row: FeedRow): string {
  return JSON.stringify(
    REVISION_FIELDS.map((field) => [field, row[field] ?? ""]),
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Deterministic content revision for one catalog row. */
export async function productRevision(row: FeedRow): Promise<string> {
  return (await sha256Hex(canonicalProductContent(row))).slice(0, PRODUCT_REVISION_LENGTH);
}

/** Immutable identity of one project render asset. */
export type RenderAssetDescriptor = {
  projectId: string;
  productId: string;
  sizeId: SizePresetId;
  productRevision: string;
  templateId: string;
  templateRevision: number;
  width: number;
  height: number;
  rendererVersion: number;
};

export function describeRenderAsset(args: {
  projectId: string;
  productId: string;
  sizeId: SizePresetId;
  productRevision: string;
  templateId: string;
  templateRevision: number;
  width: number;
  height: number;
}): RenderAssetDescriptor {
  return { ...args, rendererVersion: RENDERER_CONTRACT_VERSION };
}

function sanitizePathComponent(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 120) || "asset";
}

/** Canonical R2 object key. Untrusted components are sanitized, never raw. */
export function renderAssetKey(descriptor: RenderAssetDescriptor): string {
  const size = `${descriptor.width}x${descriptor.height}`;
  const revisions = `p${descriptor.productRevision}-t${descriptor.templateRevision}-r${descriptor.rendererVersion}`;
  // Keep the historical directory shape stable while adding the placement
  // identity to the filename. Objects written by the older ambiguous key
  // are intentionally never read through this namespace.
  return [
    RENDER_CACHE_PREFIX.replace(/\/+$/, ""),
    sanitizePathComponent(descriptor.projectId),
    sanitizePathComponent(descriptor.productId),
    sanitizePathComponent(descriptor.sizeId),
    `${sanitizePathComponent(descriptor.templateId)}-${size}-${revisions}.png`,
  ].join("/");
}

/** ETag for a versioned asset: quoted, derived from its immutable identity. */
export function renderAssetEtag(descriptor: RenderAssetDescriptor): string {
  return `"${renderAssetKey(descriptor)}"`;
}

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** One storage-adapter outcome so route tests assert without a real bucket. */
export type RenderCacheResult =
  | { kind: "hit"; bytes: Uint8Array<ArrayBuffer>; etag: string }
  | { kind: "miss" }
  | { kind: "unavailable" }
  | { kind: "write-failure"; error: string };
