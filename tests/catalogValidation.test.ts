import { describe, expect, it } from "vitest";
import { parseCatalogPrice, validateCatalog } from "@/lib/catalogValidation";
import type { FeedRow } from "@/lib/facebook";

function validRow(index: number, currency = "USD"): FeedRow {
  return {
    id: `SKU-${index}`,
    source_id: `fixture:row:${index}`,
    title: `Product ${index}`,
    description: "A complete fixture product description.",
    availability: "in stock",
    condition: "new",
    price: `19.95 ${currency}`,
    link: `https://shop.example/products/${index}`,
    image_link: `https://images.example/${index}.jpg`,
    brand: "Fixture",
    additional_image_link: "",
    item_group_id: "",
    google_product_category: "",
    sale_price: "",
    inventory: "",
  };
}

describe("shared full-catalog validation", () => {
  it("accepts supported non-EUR currencies and preserves sale currency", () => {
    const row = { ...validRow(1, "USD"), price: "20.00 USD", sale_price: "15.00 USD" };
    const result = validateCatalog([row], { imageChecks: "verified" });
    expect(result.status).toBe("ready");
    expect(result.currencyCodes).toEqual(["USD"]);
    expect(parseCatalogPrice(row.sale_price)).toEqual({ amount: 15, currency: "USD" });
  });

  it("rejects corrupt decimal prices instead of normalizing them", () => {
    for (const price of ["12.34.56 EUR", "17,90,00 EUR", "19.9 EUR", "19.999 EUR", "EUR", "12..34 EUR"]) {
      const result = validateCatalog([{ ...validRow(1), price }], { imageChecks: "verified" });
      expect(result.status).toBe("blocked");
      expect(result.issues.find((issue) => issue.code === "invalid-price")).toMatchObject({ rowIndexes: [0] });
      expect(parseCatalogPrice(price)).toBeNull();
    }
  });

  it("reports a blocking product ID for an invalid row after the preview window", () => {
    const rows = Array.from({ length: 75 }, (_, index) => validRow(index + 1));
    rows[60] = { ...rows[60], price: "19.95", link: "/relative", image_link: "" };
    const result = validateCatalog(rows, { imageChecks: "verified" });
    expect(result.status).toBe("blocked");
    for (const code of ["invalid-price", "invalid-link", "missing-image"]) {
      expect(result.issues.find((issue) => issue.code === code)).toMatchObject({
        rowIndexes: [60],
        productIds: ["SKU-61"],
      });
    }
  });

  it("detects duplicate IDs, mismatched sale currencies, and incomplete imports", () => {
    const rows = [validRow(1), { ...validRow(2), id: "SKU-1", sale_price: "10.00 EUR" }];
    const result = validateCatalog(rows, { importComplete: false, imageChecks: "verified" });
    expect(result.status).toBe("blocked");
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "incomplete-import",
      "duplicate-id",
      "sale-currency-mismatch",
    ]));
  });

  it("never presents unverified image dimensions as fully ready", () => {
    const result = validateCatalog([validRow(1)]);
    expect(result.status).toBe("needs-review");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "image-dimensions-unverified" }));
  });
});
