import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as render } from "@/app/api/render/route";
import { mapProductToRows } from "@/lib/facebook";
import { productRevision, renderAssetKey, renderAssetEtag, describeRenderAsset } from "@/lib/renderCache";
import { clearRenderMemoryForTests } from "@/lib/renderCacheStore";
import { getCatalogProject } from "@/lib/catalogProjectStore";
import { getPublicationRecord } from "@/lib/catalogPublicationStore";
import { buildPublicationSnapshot } from "@/lib/catalogPublication";
import { validateCatalog } from "@/lib/catalogValidation";
import { buildRenderUrl } from "@/lib/renderProduct";
import { isAuthenticated } from "@/lib/auth";
import { template, shopifyProduct } from "./fixtures/catalog";
import type { CatalogProject } from "@/lib/catalogProject";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  isAuthenticated: vi.fn(async () => true),
}));
vi.mock("@/lib/catalogProjectStore", () => ({ getCatalogProject: vi.fn() }));
vi.mock("@/lib/catalogPublicationStore", () => ({ getPublicationRecord: vi.fn() }));
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

const origin = "https://store.example";
const projectId = "prj_reviewfixes123";
let draft: CatalogProject;

function seedPublication(current: CatalogProject) {
  vi.mocked(getPublicationRecord).mockResolvedValue({
    schemaVersion: 1, projectId, lastAttempt: null,
    active: buildPublicationSnapshot(current, validateCatalog(current.products), 100),
  });
}

async function renderUrl(current: CatalogProject, design = current.template) {
  const row = current.products[0];
  return new URL(buildRenderUrl(design.id, {
    projectId, productId: row.source_id!, sizeId: "1:1",
    productRevision: await productRevision(row), templateRevision: design.revision ?? 0,
  }, row), origin);
}

function project(): CatalogProject {
  const products = mapProductToRows(shopifyProduct(), origin, "EUR");
  return {
    id: projectId,
    name: "Review fixtures",
    source: { type: "store", value: origin, platform: "shopify", currencyCodes: ["EUR"], currencySource: "shopify-cart" },
    products,
    template,
    placement: "carousel",
    importStatus: { complete: true, totalProducts: 1, totalRows: products.length },
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  clearRenderMemoryForTests();
  draft = structuredClone(project());
  vi.mocked(getCatalogProject).mockImplementation(async () => draft);
  vi.mocked(isAuthenticated).mockResolvedValue(true);
  seedPublication(draft);
});

describe("render cache review fixes", () => {
  it("includes placement template identity in the cache key", () => {
    const common = {
      projectId,
      productId: "shopify:variant:101",
      sizeId: "1:1" as const,
      productRevision: "0123456789abcdef",
      templateRevision: 1,
      width: 1080,
      height: 1080,
    };
    const master = renderAssetKey(describeRenderAsset({ ...common, templateId: "tpl_master" }));
    const placement = renderAssetKey(describeRenderAsset({ ...common, templateId: "tpl_placement" }));
    expect(master).not.toBe(placement);
    expect(master).toContain("tpl_master-");
    expect(placement).toContain("tpl_placement-");
    expect(master.startsWith("renders/v2/")).toBe(true);
    expect(renderAssetEtag(describeRenderAsset({ ...common, templateId: "tpl_master" })))
      .not.toBe(renderAssetEtag(describeRenderAsset({ ...common, templateId: "tpl_placement" })));
  });

  it("returns distinct master and customized placement bytes at matching revisions", async () => {
    const saved = { ...draft.template, id: "tpl_custom_placement", background: "#ff0000" };
    draft.placementTemplates = { "1:1": saved };
    seedPublication(draft);
    const masterUrl = await renderUrl(draft);
    const placementUrl = await renderUrl(draft, saved);
    const master = await render(new NextRequest(masterUrl));
    const placement = await render(new NextRequest(placementUrl));
    expect(master.status).toBe(200);
    expect(placement.status).toBe(200);
    expect(placement.headers.get("X-Render-Cache")).toBe("miss");
    expect(placement.headers.get("ETag")).not.toBe(master.headers.get("ETag"));
    const customBytes = await placement.text();
    expect(customBytes).toContain("#ff0000");
    expect(customBytes).not.toBe(await master.text());
    const repeat = await render(new NextRequest(placementUrl));
    expect(repeat.headers.get("X-Render-Cache")).toBe("hit");
    expect(await repeat.text()).toBe(customBytes);
  });

  it("serves the old cached square after the master is republished as portrait", async () => {
    const oldUrl = await renderUrl(draft);
    const first = await render(new NextRequest(oldUrl));
    expect(first.status).toBe(200);
    const bytes = await first.arrayBuffer();
    draft.template = { ...draft.template, sizeId: "4:5", height: 1350, revision: 1 };
    seedPublication(draft);
    const old = await render(new NextRequest(oldUrl));
    expect(old.status).toBe(200);
    expect(old.headers.get("X-Render-Cache")).toBe("hit-stale");
    expect(old.headers.get("ETag")).toBe(first.headers.get("ETag"));
    expect(await old.arrayBuffer()).toEqual(bytes);
    clearRenderMemoryForTests();
    expect((await render(new NextRequest(oldUrl))).status).toBe(409);
  });

  it("never exposes draft-only renders through the public stale-asset lookup", async () => {
    draft.template = { ...draft.template, revision: 1, background: "#ff0000" };
    const privateUrl = await renderUrl(draft);
    privateUrl.searchParams.set("draft", "1");
    const preview = await render(new NextRequest(privateUrl));
    expect(preview.status).toBe(200);
    expect(preview.headers.get("Cache-Control")).toBe("private, no-store");
    expect(preview.headers.get("X-Render-Cache")).toBe("bypass-draft");
    expect(await preview.text()).toContain("#ff0000");
    privateUrl.searchParams.delete("draft");
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    expect((await render(new NextRequest(privateUrl))).status).toBe(409);
  });

  it("does not share-cache the anonymous response to a draft URL", async () => {
    const url = await renderUrl(draft);
    url.searchParams.set("draft", "1");
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const response = await render(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("keeps authenticated versioned draft renders private and uncached", async () => {
    const current = project();
    const product = current.products[0];
    const revision = await productRevision(product);
    const url = new URL("https://catalog.example/api/render");
    url.search = new URLSearchParams({
      projectId,
      templateId: template.id,
      productId: product.source_id || product.id,
      sizeId: "1:1",
      productRevision: revision,
      templateRevision: "0",
      draft: "1",
    }).toString();
    const response = await render(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Render-Cache")).toBe("bypass-draft");
  });
});
