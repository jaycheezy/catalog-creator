import { describe, expect, it } from "vitest";
import {
  queryCatalogProducts,
  queryCatalogValidation,
  type CatalogQuerySuccess,
  type WorkspaceCatalogSnapshot,
} from "@/agent/catalogQueries";
import type { FeedRow } from "@/lib/facebook";
import { validateCatalog } from "@/lib/catalogValidation";

const SESSION_ID = "workspace_catalog_fixture";
const PROJECT_ID = "prj_catalog_fixture";

function fixtureRow(index: number): FeedRow {
  const variant = 1000 + index;
  return {
    id: `SKU-${String(index + 1).padStart(3, "0")}`,
    source_id: `shopify:variant:${variant}`,
    title: index === 3 || index === 4 ? "L".repeat(151) : `Fixture product ${index + 1}`,
    description: index === 2 ? "D".repeat(620) : `A useful fixture description for product ${index + 1}.`,
    availability: index === 8 ? "out of stock" : "in stock",
    condition: "new",
    price: index === 55 ? "19.99" : index === 7 ? "20.00 EUR" : "19.99 EUR",
    sale_price: index === 7 ? "15.00 EUR" : "",
    link: index < 2
      ? `https://shop.example/products/shared?variant=${variant}`
      : `https://shop.example/products/product-${index + 1}`,
    image_link: index === 56 ? "" : `https://cdn.example/images/${variant}.jpg`,
    brand: "Fixture Brand",
    item_group_id: index < 2 ? "shared" : undefined,
  };
}

function fixtureCatalog(): WorkspaceCatalogSnapshot {
  const products = Array.from({ length: 60 }, (_, index) => fixtureRow(index));
  return {
    projectId: PROJECT_ID,
    revision: 8,
    products,
    validation: validateCatalog(products, { importComplete: false, imageChecks: "not-run" }),
  };
}

function success<T>(result: { ok: boolean }): asserts result is CatalogQuerySuccess<T> {
  if (!result.ok) throw new Error("Expected a successful catalog query");
}

function identity() {
  return { sessionId: SESSION_ID, projectId: PROJECT_ID };
}

describe("catalog product queries", () => {
  it("paginates deterministically and binds cursors to the query and saved revision", () => {
    const catalog = fixtureCatalog();
    const first = queryCatalogProducts(catalog, identity());
    success<{ items: Array<{ sourceId: string }>; nextCursor: string | null; totalMatches: number }>(first);
    expect(first.data.items).toHaveLength(20);
    expect(first.data.totalMatches).toBe(60);
    expect(first.data.nextCursor).toBeTruthy();

    const second = queryCatalogProducts(catalog, { ...identity(), cursor: first.data.nextCursor });
    success<{ items: Array<{ sourceId: string }>; nextCursor: string | null }>(second);
    expect(new Set([...first.data.items, ...second.data.items].map((item) => item.sourceId)).size).toBe(40);

    expect(queryCatalogProducts(catalog, { ...identity(), text: "fixture", cursor: first.data.nextCursor }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(queryCatalogProducts({ ...catalog, revision: 9 }, { ...identity(), cursor: first.data.nextCursor }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  it("supports exact source IDs, sale filters, bounded fields, and stable title sorting", () => {
    const catalog = fixtureCatalog();
    const sharedVariants = queryCatalogProducts(catalog, {
      ...identity(),
      sourceIds: ["shopify:variant:1001", "shopify:variant:1000"],
      fields: ["feedId", "itemGroupId", "link"],
    });
    success<{ items: Array<Record<string, unknown>> }>(sharedVariants);
    expect(sharedVariants.data.items).toEqual([
      expect.objectContaining({ sourceId: "shopify:variant:1000", feedId: "SKU-001", itemGroupId: "shared" }),
      expect.objectContaining({ sourceId: "shopify:variant:1001", feedId: "SKU-002", itemGroupId: "shared" }),
    ]);
    expect(sharedVariants.data.items[0]).not.toHaveProperty("description");

    const sale = queryCatalogProducts(catalog, {
      ...identity(), saleStatus: "on-sale", fields: ["price", "salePrice"],
    });
    success<{ items: Array<Record<string, unknown>>; totalMatches: number }>(sale);
    expect(sale.data.totalMatches).toBe(1);
    expect(sale.data.items[0]).toMatchObject({ sourceId: "shopify:variant:1007", price: "20.00 EUR", salePrice: "15.00 EUR" });

    const longest = queryCatalogProducts(catalog, {
      ...identity(), sort: "title-length-desc", fields: ["title"], limit: 2,
    });
    success<{ items: Array<Record<string, unknown>> }>(longest);
    expect(longest.data.items.map((item) => item.sourceId)).toEqual([
      "shopify:variant:1003",
      "shopify:variant:1004",
    ]);

    const description = queryCatalogProducts(catalog, {
      ...identity(), sourceIds: ["shopify:variant:1002"], fields: ["description"],
    });
    success<{ items: Array<Record<string, unknown>> }>(description);
    expect(description.data.items[0]).toMatchObject({ descriptionLength: 620, descriptionTruncated: true });
    expect(String(description.data.items[0].description)).toHaveLength(500);
    expect(description.warnings[0]).toContain("untrusted source data");
  });

  it("finds a validation failure after row 50 and rejects unknown or unbounded input", () => {
    const catalog = fixtureCatalog();
    const invalidPrice = queryCatalogProducts(catalog, { ...identity(), issueCode: "invalid-price" });
    success<{ items: Array<Record<string, unknown>>; totalMatches: number }>(invalidPrice);
    expect(invalidPrice.data.totalMatches).toBe(1);
    expect(invalidPrice.data.items[0]).toMatchObject({ sourceId: "shopify:variant:1055", rowNumber: 56 });

    expect(queryCatalogProducts(catalog, { ...identity(), sourceIds: ["shopify:variant:missing"] }))
      .toMatchObject({ ok: false, error: { code: "PRODUCT_NOT_FOUND" } });
    expect(queryCatalogProducts(catalog, { ...identity(), issueCode: "not-a-real-issue" }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(queryCatalogProducts(catalog, { ...identity(), limit: 51 }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(queryCatalogProducts(catalog, { ...identity(), fields: ["secret"] }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(queryCatalogProducts(catalog, { ...identity(), unexpected: true }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });
});

describe("catalog validation queries", () => {
  it("keeps full-snapshot totals while paging affected source IDs", () => {
    const catalog = fixtureCatalog();
    const first = queryCatalogValidation(catalog, {
      ...identity(), issueCode: "image-dimensions-unverified", limit: 50,
    });
    success<{
      summary: Record<string, unknown> & { unverifiedChecks: string[]; rowCount: number };
      findings: Array<{ affected: { total: number; items: unknown[] } }>;
      nextCursor: string | null;
    }>(first);
    expect(first.data.summary).toMatchObject({ rowCount: 60, importComplete: false, imageChecks: "not-run" });
    expect(first.data.summary.unverifiedChecks).toEqual(["image-dimensions", "import-completeness"]);
    expect(first.data.findings[0].affected).toMatchObject({ total: 60 });
    expect(first.data.findings[0].affected.items).toHaveLength(50);

    const second = queryCatalogValidation(catalog, {
      ...identity(), issueCode: "image-dimensions-unverified", limit: 50, cursor: first.data.nextCursor,
    });
    success<{ summary: { rowCount: number }; findings: Array<{ affected: { items: unknown[] } }>; nextCursor: null }>(second);
    expect(second.data.summary.rowCount).toBe(60);
    expect(second.data.findings[0].affected.items).toHaveLength(10);
    expect(second.data.nextCursor).toBeNull();
  });

  it("reports late source-data issues without changing the catalog snapshot", () => {
    const catalog = fixtureCatalog();
    const before = structuredClone(catalog);
    const result = queryCatalogValidation(catalog, { ...identity(), issueCode: "invalid-price" });
    success<{
      summary: { rowCount: number; errorCount: number };
      findings: Array<{ remediation: string; affected: { items: Array<Record<string, unknown>> } }>;
    }>(result);
    expect(result.data.summary.rowCount).toBe(60);
    expect(result.data.summary.errorCount).toBeGreaterThan(0);
    expect(result.data.findings[0]).toMatchObject({
      remediation: "source-data",
      affected: { items: [{ sourceId: "shopify:variant:1055", rowNumber: 56 }] },
    });
    expect(catalog).toEqual(before);
  });
});
