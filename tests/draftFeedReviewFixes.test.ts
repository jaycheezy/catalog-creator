import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as feed } from "@/app/api/feed/route";
import { GET as render } from "@/app/api/render/route";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import { clearRenderMemoryForTests } from "@/lib/renderCacheStore";
import { mapProductToRows } from "@/lib/facebook";
import { parseFeedCsv } from "@/lib/feedImport";
import { shopifyProduct, template } from "./fixtures/catalog";
import type { CatalogProject } from "@/lib/catalogProject";
import type { CatalogPublicationRecord } from "@/lib/catalogPublication";

const app = "https://catalog.example";
const projectId = "prj_1234567890abcdef";
const origin = "https://store.example";

let draft: CatalogProject;
let publication: CatalogPublicationRecord | null;
let authenticated = true;

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, isAuthenticated: vi.fn(async () => authenticated) };
});
vi.mock("@/lib/catalogProjectStore", () => ({
  getCatalogProject: vi.fn(async () => draft),
}));
vi.mock("@/lib/catalogPublicationStore", () => ({
  getPublicationRecord: vi.fn(async () => publication),
}));
vi.mock("next/og", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return {
    ImageResponse: class extends Response {
      constructor(element: Parameters<typeof renderToStaticMarkup>[0], options?: { headers?: Record<string, string> }) {
        super(renderToStaticMarkup(element), { headers: { "Content-Type": "text/html", ...options?.headers } });
      }
    },
  };
});

function project(price = "99.00 EUR"): CatalogProject {
  const products = mapProductToRows(shopifyProduct(), origin, "EUR").map((row) => ({ ...row, price }));
  return {
    id: projectId,
    name: "Draft fixture",
    source: { type: "store", value: origin, platform: "shopify", currencyCodes: ["EUR"], currencySource: "shopify-cart" },
    products,
    template: { ...template, revision: 2 },
    placement: "carousel",
    importStatus: { complete: true, totalProducts: 1, totalRows: products.length },
    createdAt: 1,
    updatedAt: 1,
    revision: 4,
  };
}

function request(draftFlag = true) {
  const query = new URLSearchParams({ projectId });
  if (draftFlag) query.set("draft", "1");
  return new NextRequest(`${app}/api/feed?${query}`);
}

beforeEach(() => {
  clearRenderMemoryForTests();
  draft = project();
  const published = project("10.00 EUR");
  publication = {
    schemaVersion: 1,
    projectId,
    active: buildPublicationSnapshot(published, validateCatalog(published.products), 10),
    lastAttempt: null,
  };
  authenticated = true;
});

describe("draft feed review fixes", () => {
  it("round-trips an unpublished owner draft image URL", async () => {
    publication = null;
    const response = await feed(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const [row] = parseFeedCsv(await response.text());
    const imageUrl = new URL(row.image_link);
    expect(imageUrl.searchParams.get("draft")).toBe("1");
    expect(imageUrl.searchParams.get("sizeId")).toBeNull();
    const image = await render(new NextRequest(imageUrl));
    expect(image.status).toBe(200);
    expect(image.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await image.text()).toContain("99.00 EUR");
    authenticated = false;
    expect((await render(new NextRequest(imageUrl))).status).toBe(404);
  });

  it("keeps updated draft content separate from the published feed", async () => {
    const preview = parseFeedCsv(await (await feed(request())).text());
    expect(preview[0].price).toBe("99.00 EUR");
    expect(new URL(preview[0].image_link).searchParams.get("draft")).toBe("1");

    authenticated = false;
    const sharedResponse = await feed(request());
    expect(sharedResponse.status).toBe(200);
    expect(sharedResponse.headers.get("Cache-Control")).toBe("private, no-store");
    const shared = parseFeedCsv(await sharedResponse.text());
    expect(shared[0].price).toBe("10.00 EUR");
    const sharedUrl = new URL(shared[0].image_link);
    expect(sharedUrl.searchParams.get("draft")).toBeNull();
    expect(sharedUrl.searchParams.get("productRevision")).toMatch(/^[0-9a-f]{16}$/);
    const image = await render(new NextRequest(sharedUrl));
    expect(image.status).toBe(200);
    expect(await image.text()).toContain("10.00 EUR");
  });

  it("revalidates the stable published project feed on every fetch", async () => {
    authenticated = false;
    const response = await feed(request(false));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
  });
});
