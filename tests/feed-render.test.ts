import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as feed } from "@/app/api/feed/route";
import { GET as render } from "@/app/api/render/route";
import { parseFeedCsv } from "@/lib/feedImport";
import { shopifyProduct, template, wooProduct } from "./fixtures/catalog";
import { mapProductToRows } from "@/lib/facebook";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import type { CatalogProject } from "@/lib/catalogProject";

vi.mock("@/lib/templateStore", () => ({ getTemplate: vi.fn(async () => template) }));
vi.mock("@/lib/catalogProjectStore", () => ({ getCatalogProject: vi.fn() }));
vi.mock("@/lib/catalogPublicationStore", () => ({ getPublicationRecord: vi.fn(async () => null) }));
// Exercise the real routes, source mapping, and bindings. Capture the JSX sent
// to the rasterizer without fetching external images or comparing font pixels.
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

const app = "https://catalog.example";
let products = [shopifyProduct()];
let provider: "shopify" | "woocommerce";
let upstreamPaths: string[];
let shopifyCurrency: string | null;

beforeEach(() => {
  vi.mocked(getCatalogProject).mockResolvedValue(null);
  products = [shopifyProduct()];
  provider = "shopify";
  shopifyCurrency = "EUR";
  upstreamPaths = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin === app && url.pathname === "/api/templates") return Response.json(template);
    if (url.origin !== "https://store.example") throw new Error(`Unexpected fixture origin: ${url.origin}`);
    upstreamPaths.push(url.pathname);
    if (url.pathname === "/products.json") {
      return provider === "shopify" ? Response.json({ products }) : new Response("Not Shopify", { status: 404 });
    }
    if (url.pathname === "/cart.js" && provider === "shopify") return Response.json({ currency: shopifyCurrency });
    if (url.pathname === "/wp-json/wc/store/v1/products" && provider === "woocommerce") return Response.json([wooProduct()]);
    throw new Error(`Unexpected upstream request: ${url.pathname}`);
  }));
});

const feedRequest = () => new NextRequest(`${app}/api/feed?domain=store.example&templateId=${template.id}`);
const renderRequest = (params: Record<string, string>) => new NextRequest(`${app}/api/render?${new URLSearchParams({ templateId: template.id, domain: "store.example", ...params })}`);

describe("feed → exact variant render", () => {
  it("renders each feed row's title, price, and image for variants sharing a handle", async () => {
    const response = await feed(feedRequest());
    expect(response.status).toBe(200);
    expect(upstreamPaths).toContain("/cart.js");
    const csv = await response.text();
    expect(csv.split("\n")[0]).not.toContain("source_id");
    const rows = parseFeedCsv(csv);
    expect(rows.map(r => r.id)).toEqual(["MUG-SMALL", "MUG-LARGE"]);
    expect(new Set(rows.map(r => r.image_link)).size).toBe(2);
    for (const [index, row] of rows.entries()) {
      const image = await render(new NextRequest(row.image_link));
      expect(image.status).toBe(200);
      const html = await image.text();
      expect(html).toContain(`${row.title} | ${row.price}`);
      expect(html).toContain(index === 0 ? "https://images.example/small.png" : "https://images.example/large.png");
    }
  });

  it("keeps render URLs distinct even if the store reuses a SKU", async () => {
    products[0].variants.forEach(v => { v.sku = "MUG"; });
    const rows = parseFeedCsv(await (await feed(feedRequest())).text());
    expect(rows.map(r => r.id)).toEqual(["MUG", "MUG"]);
    expect(rows[0].image_link).not.toBe(rows[1].image_link);
    expect(await (await render(new NextRequest(rows[1].image_link))).text()).toContain("Mug - Large | 20.00 EUR");
  });

  it("round-trips WooCommerce feeds through the same render endpoint", async () => {
    provider = "woocommerce";
    const response = await feed(feedRequest());
    expect(response.status).toBe(200);
    const [row] = parseFeedCsv(await response.text());
    expect(new URL(row.image_link).searchParams.get("productId")).toBe("woocommerce:product:201");
    const image = await render(new NextRequest(row.image_link));
    expect(image.status).toBe(200);
    expect(await image.text()).toContain("Coffee cup | 12.50 USD");
  });

  it("does not silently label Shopify prices as EUR when currency lookup fails", async () => {
    shopifyCurrency = null;
    const response = await feed(feedRequest());
    expect(response.headers.get("X-Catalog-Validation")).toBe("blocked");
    const rows = parseFeedCsv(await response.text());
    expect(rows.map((row) => row.price)).toEqual(["10.00", "20.00"]);
  });

  it("returns 404 for an unknown explicit variant without a provider or handle fallback", async () => {
    const response = await render(renderRequest({ productId: "shopify:variant:999", handle: "mug" }));
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Product not found");
    expect(upstreamPaths).not.toContain("/wp-json/wc/store/v1/products");
  });

  it("returns 409 for ambiguous old links but supports an unambiguous legacy handle", async () => {
    expect((await render(renderRequest({ handle: "mug" }))).status).toBe(409);
    products[0].variants = [products[0].variants[0]];
    expect((await render(renderRequest({ handle: "mug" }))).status).toBe(200);
  });

  it("does not render a product excluded from the feed", async () => {
    products[0].variants.forEach(v => { v.requires_shipping = false; });
    const response = await render(renderRequest({ productId: "shopify:variant:102" }));
    expect(response.status).toBe(404);
    const csv = await (await feed(feedRequest())).text();
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("rejects empty product IDs before loading templates or catalogs", async () => {
    expect((await render(renderRequest({ productId: "", handle: "mug" }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the published snapshot for feeds and renders without upstream refetches", async () => {
    const id = "prj_1234567890abcdef";
    const rows = mapProductToRows(shopifyProduct(), "https://store.example", "EUR");
    const project: CatalogProject = {
      id,
      name: "Fixture project",
      source: { type: "feed-url", value: "https://feeds.example/catalog.csv", format: "csv" },
      products: rows,
      template,
      placement: "carousel",
      importStatus: { complete: true, totalProducts: 1, totalRows: 2 },
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(getCatalogProject).mockResolvedValue(project);
    // Anonymous project reads serve the frozen publication, not the draft.
    vi.mocked(getPublicationRecord).mockImplementation(async () => ({
      schemaVersion: 1 as const,
      projectId: id,
      active: buildPublicationSnapshot(project, validateCatalog(rows, { importComplete: true }), 1000),
      lastAttempt: null,
    }));

    const response = await feed(new NextRequest(`${app}/api/feed?projectId=${id}&templateId=${template.id}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Catalog-Validation")).toBe("needs-review");
    const exported = parseFeedCsv(await response.text());
    expect(exported).toHaveLength(2);
    expect(exported.every((row) => new URL(row.image_link).searchParams.get("projectId") === id)).toBe(true);
    const image = await render(new NextRequest(exported[1].image_link));
    expect(image.status).toBe(200);
    expect(await image.text()).toContain("Mug - Large | 20.00 EUR");
    expect(fetch).not.toHaveBeenCalled();
  });
});
