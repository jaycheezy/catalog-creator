import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as feed } from "@/app/api/feed/route";
import { GET as render } from "@/app/api/render/route";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import { mapProductToRows } from "@/lib/facebook";
import { wooProductToRow } from "@/lib/woocommerce";
import { buildRenderUrl } from "@/lib/renderProduct";
import {
  IMMUTABLE_CACHE_CONTROL,
  canonicalProductContent,
  describeRenderAsset,
  productRevision,
  renderAssetEtag,
  renderAssetKey,
  sha256Hex,
} from "@/lib/renderCache";
import { clearRenderMemoryForTests, readRenderAsset, writeRenderAsset } from "@/lib/renderCacheStore";
import type { CatalogProject } from "@/lib/catalogProject";
import type { FeedRow } from "@/lib/facebook";
import { shopifyProduct, template, wooProduct } from "./fixtures/catalog";
import { DurableStorageError } from "@/lib/durableStorage";

const origin = "https://store.example";

function row(): FeedRow {
  return mapProductToRows(shopifyProduct(), origin, "EUR")[1];
}

describe("canonical product revisions", () => {
  it("hashes stably with fixed key order and empty absent values", async () => {
    const base = row();
    expect(await productRevision(base)).toBe(await productRevision(structuredClone(base)));
    expect(canonicalProductContent(base)).toContain('"price"');
    expect(canonicalProductContent({ ...base, sale_price: undefined })).toContain('"sale_price",""');
    expect((await productRevision(base)).length).toBe(16);
  });

  it("changes for every render-relevant field and nothing else", async () => {
    const base = row();
    const before = await productRevision(base);
    for (const patch of [
      { price: "21.00 EUR" },
      { sale_price: "5.00 EUR" },
      { title: "Mug - Extra Large" },
      { description: "Changed" },
      { link: "https://store.example/products/other" },
      { image_link: "https://images.example/other.png" },
      { brand: "Other" },
      { availability: "out of stock" as const },
      { condition: "used" as const },
      { id: "RENAMED" },
    ] as Partial<FeedRow>[]) {
      expect(await productRevision({ ...base, ...patch })).not.toBe(before);
    }
    expect(await productRevision({ ...base, inventory: "changed-note" })).toBe(before);
  });

  it("digests with SHA-256 hex", async () => {
    expect(await sha256Hex("catalog-forge")).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("catalog-forge")).toBe(await sha256Hex("catalog-forge"));
  });
});

describe("versioned asset identity", () => {
  const descriptor = describeRenderAsset({
    projectId: "prj_1234567890abcdef",
    productId: "shopify:variant:102",
    sizeId: "9:16",
    productRevision: "0123456789abcdef",
    templateId: "tpl_story",
    templateRevision: 2,
    width: 1080,
    height: 1920,
  });

  it("builds prefixed keys with sanitized components", () => {
    const key = renderAssetKey(descriptor);
    expect(key.startsWith("renders/v2/")).toBe(true);
    expect(key).toContain("1080x1920");
    expect(key).toContain("p0123456789abcdef-t2-r1");
    expect(key.endsWith(".png")).toBe(true);
    expect(key).not.toContain(":");
    const evil = renderAssetKey({ ...descriptor, productId: "../../etc/passwd?x=1" });
    expect(evil.split("/")).toHaveLength(6);
    expect(evil.split("/")[3]).not.toContain("/");
    expect(evil).not.toContain("?");
  });

  it("derives stable ETags from immutable identity", () => {
    expect(renderAssetEtag(descriptor)).toBe(`"${renderAssetKey(descriptor)}"`);
  });

  it("builds versioned URLs without disturbing the legacy contract", () => {
    const url = new URL(
      buildRenderUrl("tpl_story", {
        projectId: "prj_1234567890abcdef",
        productId: "shopify:variant:102",
        sizeId: "9:16",
        productRevision: "0123456789abcdef",
        templateRevision: 2,
      }, row()),
      origin,
    );
    expect(url.pathname).toBe("/api/render");
    expect(url.searchParams.get("sizeId")).toBe("9:16");
    expect(url.searchParams.get("productRevision")).toBe("0123456789abcdef");
    expect(url.searchParams.get("templateRevision")).toBe("2");
    const legacy = new URL(buildRenderUrl("tpl_x", { projectId: "prj_1234567890abcdef" }, row()), origin);
    expect(legacy.searchParams.get("sizeId")).toBeNull();
    expect(() => buildRenderUrl("tpl_x", {
      projectId: "prj_1234567890abcdef",
      productId: "shopify:variant:999",
      sizeId: "1:1",
      productRevision: "0123456789abcdef",
      templateRevision: 1,
    }, row())).toThrow("does not match");
  });
});

describe("versioned render storage adapter", () => {
  const descriptor = describeRenderAsset({
    projectId: "prj_adapter",
    productId: "csv:row:1",
    sizeId: "1:1",
    productRevision: "aaaaaaaaaaaaaaaa",
    templateId: "tpl_a",
    templateRevision: 1,
    width: 1080,
    height: 1080,
  });
  const bytes = new Uint8Array([137, 80, 78, 71]);

  it("reports unavailable for an explicit null bucket", async () => {
    expect(await readRenderAsset(descriptor, null)).toEqual({ kind: "unavailable" });
  });

  it("round-trips through the development memory adapter", async () => {
    clearRenderMemoryForTests();
    expect(await readRenderAsset(descriptor)).toEqual({ kind: "miss" });
    await writeRenderAsset(descriptor, bytes, renderAssetEtag(descriptor));
    const hit = await readRenderAsset(descriptor);
    expect(hit).toMatchObject({ kind: "hit", etag: renderAssetEtag(descriptor) });
    if (hit.kind === "hit") expect([...hit.bytes]).toEqual([137, 80, 78, 71]);
  });

  it("wraps write failures without claiming cached success", async () => {
    const failing = {
      get: async () => null,
      put: async () => { throw new Error("R2 down"); },
      list: async () => [],
    };
    await expect(writeRenderAsset(descriptor, bytes, "etag", failing)).rejects.toBeInstanceOf(DurableStorageError);
  });
});

const app = "https://catalog.example";
const projectId = "prj_1234567890abcdef";
const storyId = "tpl_story_placement";

vi.mock("@/lib/catalogProjectStore", () => ({ getCatalogProject: vi.fn() }));
vi.mock("@/lib/catalogPublicationStore", () => ({ getPublicationRecord: vi.fn() }));
vi.mock("next/og", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return {
    ImageResponse: class extends Response {
      constructor(element: Parameters<typeof renderToStaticMarkup>[0]) {
        super(renderToStaticMarkup(element), { headers: { "Content-Type": "text/html" } });
      }
    },
  };
});

function project(): CatalogProject {
  const rows = [
    ...mapProductToRows(shopifyProduct(), origin, "EUR"),
    wooProductToRow(wooProduct(), "Fixture"),
  ];
  return {
    id: projectId,
    name: "Versioned fixture",
    source: { type: "store", value: origin, platform: "shopify", currencyCodes: ["EUR"], currencySource: "shopify-cart" },
    products: rows,
    template,
    placement: "carousel",
    placementTemplates: {
      "9:16": { ...template, id: storyId, name: "Fixture — 9:16", sizeId: "9:16", width: 1080, height: 1920, revision: 2 },
    },
    importStatus: { complete: true, totalProducts: 2, totalRows: 3 },
    createdAt: 1,
    updatedAt: 1,
    revision: 2,
  };
}

function versionedUrl(params: Record<string, string>): string {
  const full = new URLSearchParams({ projectId, ...params });
  return `${app}/api/render?${full.toString()}`;
}

beforeEach(() => {
  clearRenderMemoryForTests();
  vi.mocked(getCatalogProject).mockImplementation(async (id: string) => (id === projectId ? project() : null));
  // Anonymous reads serve the frozen publication. Tests that change prices
  // republish by replacing the seeded record below.
  vi.mocked(getPublicationRecord).mockImplementation(async (id: string) => {
    if (id !== projectId) return null;
    const current = project();
    return {
      schemaVersion: 1 as const,
      projectId,
      active: buildPublicationSnapshot(current, validateCatalog(current.products, { importComplete: true }), 1000),
      lastAttempt: null,
    };
  });
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("upstream fetch is forbidden on the versioned path"); }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("versioned project render route", () => {
  it("misses, stores, then hits with identical bytes and ETag", async () => {
    const pv = await productRevision(project().products[1]);
    const url = versionedUrl({ templateId: storyId, productId: "shopify:variant:102", sizeId: "9:16", productRevision: pv, templateRevision: "2" });
    const miss = await render(new NextRequest(url));
    expect(miss.status).toBe(200);
    expect(miss.headers.get("X-Render-Cache")).toBe("miss");
    expect(miss.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_CONTROL);
    const missBytes = await miss.arrayBuffer();
    const missEtag = miss.headers.get("ETag");
    expect(missEtag).toMatch(/^"renders\/v2\/.*-t2-r1\.png"$/);

    const hit = await render(new NextRequest(url));
    expect(hit.status).toBe(200);
    expect(hit.headers.get("X-Render-Cache")).toBe("hit");
    expect(hit.headers.get("ETag")).toBe(missEtag);
    expect(await hit.arrayBuffer()).toEqual(missBytes);
  });

  it("issues a new image URL after a price change", async () => {
    const rows = project().products;
    const before = await productRevision(rows[1]);
    const after = await productRevision({ ...rows[1], price: "21.00 EUR" });
    expect(after).not.toBe(before);
    // Republishing freezes the changed catalog into a new snapshot.
    const republished = project();
    republished.products = [rows[0], { ...rows[1], price: "21.00 EUR" }, rows[2]];
    vi.mocked(getPublicationRecord).mockImplementation(async () => ({
      schemaVersion: 1 as const,
      projectId,
      active: buildPublicationSnapshot(republished, validateCatalog(republished.products, { importComplete: true }), 2000),
      lastAttempt: null,
    }));
    const url = versionedUrl({ templateId: storyId, productId: "shopify:variant:102", sizeId: "9:16", productRevision: after, templateRevision: "2" });
    const response = await render(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Render-Cache")).toBe("miss");
    expect(await response.text()).toContain("21.00 EUR");
  });

  it("rejects stale and malformed revisions without rendering", async () => {
    const pv = await productRevision(project().products[1]);
    const base = { templateId: storyId, productId: "shopify:variant:102", sizeId: "9:16" };
    expect((await render(new NextRequest(versionedUrl({ ...base, productRevision: "ffffffffffffffff", templateRevision: "2" })))).status).toBe(409);
    expect((await render(new NextRequest(versionedUrl({ ...base, productRevision: pv, templateRevision: "99" })))).status).toBe(409);
    expect((await render(new NextRequest(versionedUrl({ ...base, productRevision: "xyz", templateRevision: "2" })))).status).toBe(400);
    expect((await render(new NextRequest(versionedUrl({ ...base, sizeId: "16:9", productRevision: pv, templateRevision: "2" })))).status).toBe(400);
    expect((await render(new NextRequest(versionedUrl({ templateId: template.id, productId: "shopify:variant:101", sizeId: "9:16", productRevision: pv, templateRevision: "0" })))).status).toBe(409);
    expect((await render(new NextRequest(versionedUrl({ templateId: "tpl_nope", productId: "shopify:variant:101", sizeId: "1:1", productRevision: pv, templateRevision: "0" })))).status).toBe(404);
    expect((await render(new NextRequest(versionedUrl({ templateId: storyId, productId: "shopify:variant:999", sizeId: "9:16", productRevision: pv, templateRevision: "2" })))).status).toBe(404);
  });

  it("renders WooCommerce rows by exact source ID without upstream fetches", async () => {
    const woo = wooProductToRow(wooProduct(), "Fixture");
    const pv = await productRevision(woo);
    const url = versionedUrl({ templateId: template.id, productId: "woocommerce:product:201", sizeId: "1:1", productRevision: pv, templateRevision: "0" });
    const response = await render(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Coffee cup | 12.50 USD");
  });

  it("returns a retryable error instead of uncached bytes when R2 is unavailable", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowLocal = process.env.CATALOG_FORGE_ALLOW_LOCAL_STORAGE;
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CATALOG_FORGE_ALLOW_LOCAL_STORAGE;
    try {
      const pv = await productRevision(project().products[1]);
      const url = versionedUrl({ templateId: storyId, productId: "shopify:variant:102", sizeId: "9:16", productRevision: pv, templateRevision: "2" });
      const response = await render(new NextRequest(url));
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
    } finally {
      vi.stubEnv("NODE_ENV", previousNodeEnv ?? "test");
      if (previousAllowLocal === undefined) delete process.env.CATALOG_FORGE_ALLOW_LOCAL_STORAGE;
      else process.env.CATALOG_FORGE_ALLOW_LOCAL_STORAGE = previousAllowLocal;
    }
  });

  it("serves project feeds with versioned image links", async () => {
    const response = await feed(new NextRequest(`${app}/api/feed?${new URLSearchParams({ projectId, templateId: storyId })}`));
    expect(response.status).toBe(200);
    const csv = await response.text();
    const linkLine = csv.split("\n").find((line) => line.includes("shopify%3Avariant%3A102") || line.includes("shopify:variant:102"));
    expect(linkLine).toBeDefined();
    const imageLink = linkLine!.split(",").find((cell) => cell.includes("/api/render"))!;
    const params = new URL(imageLink).searchParams;
    expect(params.get("sizeId")).toBe("9:16");
    expect(params.get("productRevision")).toMatch(/^[0-9a-f]{16}$/);
    expect(params.get("templateRevision")).toBe("2");
    // Every feed-issued link resolves through the versioned cache path.
    const resolved = await render(new NextRequest(imageLink));
    expect(resolved.status).toBe(200);
    expect(["hit", "miss"]).toContain(resolved.headers.get("X-Render-Cache"));
  });
});
