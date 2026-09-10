import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CatalogProject } from "@/lib/catalogProject";
import type { StoreCatalog } from "@/lib/storeCatalog";
import type { ImportedRemoteFeed } from "@/lib/remoteFeed";
import { mapProductToRows } from "@/lib/facebook";
import { parseFeedCsv, parseFeedXml } from "@/lib/feedImport";
import { wooProductToRow } from "@/lib/woocommerce";
import { shopifyProduct, template, wooProduct } from "./fixtures/catalog";
import { workflowXmlFeed } from "./fixtures/workflow";
import { DurableStorageError } from "@/lib/durableStorage";

let savedProject: CatalogProject | null = null;
let projectSaveError: Error | null = null;
let storeCatalog: StoreCatalog | null = null;
let remoteFeed: ImportedRemoteFeed | null = null;

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, isAuthenticated: vi.fn(async () => true) };
});
vi.mock("@/lib/templateStore", () => ({ saveTemplate: vi.fn(async () => undefined) }));
vi.mock("@/lib/catalogProjectStore", () => ({
  saveCatalogProject: vi.fn(async (project: CatalogProject) => {
    if (projectSaveError) throw projectSaveError;
    savedProject = structuredClone(project);
  }),
  getCatalogProject: vi.fn(async () => savedProject),
}));
vi.mock("@/lib/storeCatalog", () => ({
  fetchStoreCatalog: vi.fn(async () => {
    if (!storeCatalog) throw new Error("No store fixture configured");
    return structuredClone(storeCatalog);
  }),
}));
vi.mock("@/lib/remoteFeed", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/remoteFeed")>();
  return {
    ...original,
    importRemoteFeed: vi.fn(async () => {
      if (!remoteFeed) throw new Error("No remote feed fixture configured");
      return structuredClone(remoteFeed);
    }),
  };
});

import { GET, PATCH, POST } from "@/app/api/projects/route";
import { saveCatalogProject } from "@/lib/catalogProjectStore";

beforeEach(() => {
  savedProject = null;
  projectSaveError = null;
  storeCatalog = null;
  remoteFeed = null;
});

describe("catalog project API", () => {
  it("creates and reopens Shopify, WooCommerce, remote CSV, and remote XML projects", async () => {
    const shopifyRows = mapProductToRows(shopifyProduct(), "https://store.example", "GBP");
    const wooRows = [wooProductToRow(wooProduct(), "Fixture")];
    const remoteCsvRows = parseFeedCsv(
      "id,title,description,availability,condition,price,sale_price,link,image_link,brand\n" +
      "REMOTE-1,Lamp,A complete product description.,in stock,new,20.00 USD,15.00 USD,https://shop.example/lamp,https://images.example/lamp.jpg,Beam",
    );
    const remoteXmlRows = parseFeedXml(workflowXmlFeed);
    const cases: Array<{
      name: string;
      source: { type: "store" | "feed-url"; value: string };
      configure: () => void;
      expected: Partial<CatalogProject["source"]>;
      rows: number;
    }> = [
      {
        name: "Shopify",
        source: { type: "store", value: "store.example" },
        configure: () => {
          storeCatalog = { rows: shopifyRows, totalProducts: 1, platform: "shopify", complete: true, totalFetched: 1, currencyCodes: ["GBP"], currencySource: "shopify-cart" };
        },
        expected: { type: "store", platform: "shopify", currencyCodes: ["GBP"] },
        rows: 2,
      },
      {
        name: "WooCommerce",
        source: { type: "store", value: "store.example" },
        configure: () => {
          storeCatalog = { rows: wooRows, totalProducts: 1, platform: "woocommerce", complete: true, totalFetched: 1, currencyCodes: ["USD"], currencySource: "woocommerce-api" };
        },
        expected: { type: "store", platform: "woocommerce", currencyCodes: ["USD"] },
        rows: 1,
      },
      {
        name: "remote CSV",
        source: { type: "feed-url", value: "https://feeds.example/catalog.csv" },
        configure: () => {
          remoteFeed = { url: "https://feeds.example/catalog.csv", contentType: "text/csv", format: "csv", rows: remoteCsvRows };
        },
        expected: { type: "feed-url", value: "https://feeds.example/catalog.csv", format: "csv" },
        rows: 1,
      },
      {
        name: "remote XML",
        source: { type: "feed-url", value: "https://feeds.example/catalog.xml" },
        configure: () => {
          remoteFeed = { url: "https://feeds.example/catalog.xml", contentType: "application/xml", format: "xml", rows: remoteXmlRows };
        },
        expected: { type: "feed-url", value: "https://feeds.example/catalog.xml", format: "xml" },
        rows: 2,
      },
    ];

    for (const testCase of cases) {
      savedProject = null;
      storeCatalog = null;
      remoteFeed = null;
      testCase.configure();
      const created = await POST(new NextRequest("https://catalog.example/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: testCase.source, template, placement: "carousel" }),
      }));
      expect(created.status, testCase.name).toBe(200);
      const payload = await created.json() as { id: string; totalRows: number };
      expect(payload.totalRows, testCase.name).toBe(testCase.rows);

      const reopened = await GET(new NextRequest(`https://catalog.example/api/projects?id=${payload.id}`));
      expect(reopened.status, testCase.name).toBe(200);
      const reopenedProject = await reopened.json() as CatalogProject;
      expect(reopenedProject, testCase.name).toMatchObject({
        id: payload.id,
        source: testCase.expected,
        products: expect.any(Array),
        template: { id: template.id, sizeId: "1:1" },
      });
      expect(reopenedProject.products, testCase.name).toHaveLength(testCase.rows);
    }
  });

  it("persists every CSV row instead of the 200-row preview", async () => {
    const csvRows = Array.from({ length: 250 }, (_, i) => [
      i + 1,
      `Product ${i + 1}`,
      "A complete product description",
      "in stock",
      "new",
      i === 60 ? '"12.34.56 EUR"' : '"17,90 EUR"',
      `https://shop.example/products/${i + 1}`,
      i === 249 ? "" : `https://images.example/${i + 1}.jpg`,
      "Fixture",
    ].join(",")).join("\n");
    const response = await POST(new NextRequest("https://catalog.example/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { type: "csv", value: "catalog.csv", csvText: `id,title,description,availability,condition,price,link,image_link,brand\n${csvRows}` },
        template,
        placement: "story",
      }),
    }));
    expect(response.status).toBe(200);
    expect(savedProject?.products).toHaveLength(250);
    expect(savedProject?.products[249]).toMatchObject({ price: "17.90 EUR", source_id: "csv:row:250" });
    expect(savedProject?.products[60]).toMatchObject({ price: "12.34.56 EUR", source_id: "csv:row:61" });
    expect(savedProject?.placement).toBe("story");
    expect(savedProject?.validation?.issues.find((issue) => issue.code === "missing-image")).toMatchObject({
      rowIndexes: [249],
      productIds: ["250"],
    });
    expect(savedProject?.validation?.issues.find((issue) => issue.code === "invalid-price")).toMatchObject({
      rowIndexes: [60],
      productIds: ["61"],
    });

    const json = await response.json() as { id: string };
    const reopened = await GET(new NextRequest(`https://catalog.example/api/projects?id=${json.id}`));
    expect(((await reopened.json()) as CatalogProject).products).toHaveLength(250);
  });

  it("updates design state without replacing the saved catalog", async () => {
    savedProject = {
      id: "prj_1234567890abcdef",
      name: "Fixture",
      source: { type: "csv", value: "catalog.csv", format: "csv" },
      products: [{ id: "1", source_id: "csv:row:1", title: "Tea", description: "Tea", availability: "in stock", condition: "new", price: "10.00 EUR", link: "", image_link: "", brand: "Fixture", additional_image_link: "", item_group_id: "", google_product_category: "", sale_price: "", inventory: "" }],
      template,
      placement: "carousel",
      importStatus: { complete: true, totalProducts: 1, totalRows: 1 },
      createdAt: 1,
      updatedAt: 1,
    };
    const changed = { ...template, name: "Updated design", layers: [...template.layers].reverse() };
    const response = await PATCH(new NextRequest("https://catalog.example/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedProject.id, template: changed, placement: "portrait" }),
    }));
    expect(response.status).toBe(200);
    expect(savedProject.products).toHaveLength(1);
    expect(savedProject.template.name).toBe("Updated design");
    expect(savedProject.placement).toBe("portrait");
    expect(savedProject.revision).toBe(1);
    expect(savedProject.template.revision).toBe(1);
  });

  it("returns a retryable error without mutating the saved revision when durable storage fails", async () => {
    savedProject = {
      id: "prj_1234567890abcdef",
      name: "Fixture",
      source: { type: "csv", value: "catalog.csv", format: "csv" },
      products: [],
      template: { ...template, name: "Saved design", revision: 2 },
      placement: "carousel",
      importStatus: { complete: true, totalProducts: 0, totalRows: 0 },
      createdAt: 1,
      updatedAt: 2,
      revision: 3,
    };
    projectSaveError = new DurableStorageError("R2 write failed");

    const response = await PATCH(new NextRequest("https://catalog.example/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: savedProject.id,
        expectedRevision: 3,
        template: { ...savedProject.template, name: "Unsaved draft" },
      }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "R2 write failed",
      code: "DURABLE_STORAGE_FAILED",
      retryable: true,
    });
    expect(savedProject.template.name).toBe("Saved design");
    expect(savedProject.revision).toBe(3);
  });

  it("rejects a stale editor revision before writing", async () => {
    savedProject = {
      id: "prj_1234567890abcdef",
      name: "Fixture",
      source: { type: "csv", value: "catalog.csv", format: "csv" },
      products: [],
      template: { ...template, revision: 4 },
      placement: "carousel",
      importStatus: { complete: true, totalProducts: 0, totalRows: 0 },
      createdAt: 1,
      updatedAt: 2,
      revision: 5,
    };

    const response = await PATCH(new NextRequest("https://catalog.example/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedProject.id, expectedRevision: 4, template }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "REVISION_CONFLICT", retryable: false, revision: 5 });
    expect(saveCatalogProject).not.toHaveBeenCalled();
  });
});
