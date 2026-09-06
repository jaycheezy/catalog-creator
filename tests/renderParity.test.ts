import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as render } from "@/app/api/render/route";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import { mapProductToRows } from "@/lib/facebook";
import type { CatalogProject } from "@/lib/catalogProject";
import type { Template } from "@/editor/types";
import { shopifyProduct } from "./fixtures/catalog";

vi.mock("@/lib/catalogProjectStore", () => ({ getCatalogProject: vi.fn() }));
vi.mock("@/lib/catalogPublicationStore", () => ({ getPublicationRecord: vi.fn() }));
// Capture the JSX sent to the rasterizer without comparing font pixels.
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

function stressTemplate(): Template {
  return {
    id: "tpl_stress",
    name: "Stress",
    sizeId: "1:1",
    width: 1080,
    height: 1080,
    background: "#ffffff",
    layers: [
      {
        id: "layer_image",
        type: "product-image",
        name: "Product Image",
        x: 80,
        y: 80,
        w: 920,
        h: 680,
        rotation: 0,
        z: 1,
        visible: true,
        locked: false,
        style: { background: "#fafaf7", borderRadius: 24, opacity: 1 },
        objectFit: "contain",
      },
      {
        id: "layer_title",
        type: "text",
        name: "Long Title",
        x: 80,
        y: 790,
        w: 920,
        h: 120,
        rotation: 12,
        z: 2,
        visible: true,
        locked: false,
        style: {
          color: "#1a1a1a",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "Inter",
          textAlign: "left",
          lineHeight: 1.5,
          letterSpacing: 0.05,
          opacity: 0.6,
          borderWidth: 2,
          borderColor: "#ff0000",
          borderRadius: 8,
          shadow: "0 2px 8px rgba(0,0,0,0.3)",
          padding: 10,
          textTransform: "uppercase",
        },
        content: "{{title}}",
      },
      {
        id: "layer_price",
        type: "badge",
        name: "Sale Badge",
        x: 420,
        y: 930,
        w: 240,
        h: 64,
        rotation: 0,
        z: 3,
        visible: true,
        locked: false,
        style: {
          background: "#111111",
          color: "#ffffff",
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "Arial",
          textAlign: "right",
          borderRadius: 999,
          opacity: 1,
        },
        content: "{{price}}",
      },
      {
        id: "layer_shape",
        type: "shape",
        name: "Accent",
        x: 80,
        y: 80,
        w: 120,
        h: 120,
        rotation: 0,
        z: 4,
        visible: true,
        locked: false,
        style: { background: "#ff0000", opacity: 0.5 },
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  const rows = mapProductToRows(shopifyProduct(), "https://store.example", "EUR");
  const withoutImage = { ...rows[1], image_link: "" };
  const project: CatalogProject = {
    id: projectId,
    name: "Parity fixture",
    source: { type: "store", value: "store.example", platform: "shopify", currencyCodes: ["EUR"], currencySource: "shopify-cart" },
    products: [rows[0], withoutImage],
    template: stressTemplate(),
    placement: "carousel",
    importStatus: { complete: true, totalProducts: 1, totalRows: 2 },
    createdAt: 1,
    updatedAt: 1,
  };
  vi.mocked(getCatalogProject).mockResolvedValue(project);
  // Anonymous project reads serve the frozen publication, not the draft.
  vi.mocked(getPublicationRecord).mockImplementation(async () => ({
    schemaVersion: 1 as const,
    projectId,
    active: buildPublicationSnapshot(project, validateCatalog(project.products, { importComplete: true }), 1000),
    lastAttempt: null,
  }));
});

const renderRequest = (productId: string) =>
  new NextRequest(`${app}/api/render?${new URLSearchParams({ projectId, productId })}`);

describe("browser/server render parity", () => {
  it("renders rotation, opacity, border, shadow, spacing, and fallback fonts in server PNG markup", async () => {
    const response = await render(renderRequest("shopify:variant:101"));
    expect(response.status).toBe(200);
    const html = await response.text();
    // Shared projection: rotation, translucency, border, radius, shadow.
    expect(html).toContain("rotate(12deg)");
    expect(html).toContain("opacity:0.6");
    expect(html).toContain("2px solid #ff0000");
    expect(html).toContain("border-radius:8px");
    expect(html).toContain("box-shadow:0 2px 8px rgba(0,0,0,0.3)");
    // Typography: em spacing projected to px, JS uppercasing, bundled Inter face.
    expect(html).toContain("letter-spacing:2.1px");
    expect(html).toContain("MUG - SMALL");
    expect(html).toContain("font-family:Inter");
    // Unified padding default: the badge without an explicit padding uses 8px.
    expect(html).toContain("padding:8px");
    // Sale badge keeps its right alignment in flex and text layers.
    expect(html).toContain("justify-content:flex-end");
    // Canvas and layers clip instead of overflowing the export.
    expect(html).toContain("overflow:hidden");
    // Shape layers render without placeholder text.
    expect(html).not.toContain("—");
  });

  it("renders a consistent missing-image block instead of an empty layer", async () => {
    const response = await render(renderRequest("shopify:variant:102"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("No image — MUG-LARGE");
    expect(html).toContain("font-size:14px");
  });
});
