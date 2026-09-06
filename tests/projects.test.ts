import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CatalogProject } from "@/lib/catalogProject";
import { template } from "./fixtures/catalog";
import { DurableStorageError } from "@/lib/durableStorage";

let savedProject: CatalogProject | null = null;
let projectSaveError: Error | null = null;

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

import { GET, PATCH, POST } from "@/app/api/projects/route";
import { saveCatalogProject } from "@/lib/catalogProjectStore";

beforeEach(() => {
  savedProject = null;
  projectSaveError = null;
});

describe("catalog project API", () => {
  it("persists every CSV row instead of the 200-row preview", async () => {
    const csvRows = Array.from({ length: 250 }, (_, i) => [
      i + 1,
      `Product ${i + 1}`,
      "A complete product description",
      "in stock",
      "new",
      '"17,90 EUR"',
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
    expect(savedProject?.placement).toBe("story");
    expect(savedProject?.validation?.issues.find((issue) => issue.code === "missing-image")).toMatchObject({
      rowIndexes: [249],
      productIds: ["250"],
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
