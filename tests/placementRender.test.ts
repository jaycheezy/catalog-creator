import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as feed } from "@/app/api/feed/route";
import { GET as render } from "@/app/api/render/route";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import { mapProductToRows } from "@/lib/facebook";
import { wooProductToRow } from "@/lib/woocommerce";
import type { CatalogProject } from "@/lib/catalogProject";
import { shopifyProduct, template, wooProduct } from "./fixtures/catalog";

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

const app = "https://catalog.example";
const projectId = "prj_1234567890abcdef";
const storyId = "tpl_story_placement";
const origin = "https://store.example";

beforeEach(() => {
  const rows = [
    ...mapProductToRows(shopifyProduct(), origin, "EUR"),
    wooProductToRow(wooProduct(), "Fixture"),
  ];
  const project: CatalogProject = {
    id: projectId,
    name: "Placement fixture",
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
  vi.mocked(getCatalogProject).mockImplementation(async (id: string) => (id === projectId ? project : null));
  // Anonymous project reads serve the frozen publication, not the draft.
  vi.mocked(getPublicationRecord).mockImplementation(async (id: string) =>
    id === projectId
      ? {
        schemaVersion: 1 as const,
        projectId,
        active: buildPublicationSnapshot(project, validateCatalog(project.products, { importComplete: true }), 1000),
        lastAttempt: null,
      }
      : null,
  );
});

describe("project placement render and feed links", () => {
  it("renders the saved 9:16 placement with its own dimensions for a Shopify variant", async () => {
    const response = await render(new NextRequest(
      `${app}/api/render?${new URLSearchParams({ projectId, templateId: storyId, productId: "shopify:variant:102" })}`,
    ));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("width:1080px");
    expect(html).toContain("height:1920px");
    expect(html).toContain("Mug - Large | 20.00 EUR");
  });

  it("renders the 1:1 placement for a WooCommerce product by exact source ID", async () => {
    const response = await render(new NextRequest(
      `${app}/api/render?${new URLSearchParams({ projectId, templateId: template.id, productId: "woocommerce:product:201" })}`,
    ));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Coffee cup | 12.50 USD");
  });

  it("rejects placement template IDs that do not belong to the project", async () => {
    const params = new URLSearchParams({ projectId, templateId: "tpl_nope_nope_nope", productId: "shopify:variant:101" });
    expect((await render(new NextRequest(`${app}/api/render?${params}`))).status).toBe(404);
    expect((await feed(new NextRequest(`${app}/api/feed?${params}`))).status).toBe(404);
  });

  it("serves the project feed for a saved placement template", async () => {
    const response = await feed(new NextRequest(
      `${app}/api/feed?${new URLSearchParams({ projectId, templateId: storyId })}`,
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Total-Variants")).toBe("3");
  });
});
