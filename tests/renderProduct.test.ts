import { describe, expect, it } from "vitest";
import { mapProductToRows, rowsToCsv } from "@/lib/facebook";
import { wooProductToRow } from "@/lib/woocommerce";
import { buildRenderUrl, selectRenderProduct } from "@/lib/renderProduct";
import { resolveBinding } from "@/editor/bindings";
import { shopifyProduct, wooProduct } from "./fixtures/catalog";

const origin = "https://store.example";

describe("stable product identity", () => {
  it("moves published images off old immutable HTTP URLs without changing draft targets", () => {
    const row = mapProductToRows(shopifyProduct(), origin, "EUR")[0];
    const current = new URL(buildRenderUrl("tpl_design", {
      projectId: "prj_1234567890abcdef", productId: row.source_id!,
      sizeId: "1:1", productRevision: "0123456789abcdef", templateRevision: 1,
    }, row), origin);
    const previous = new URL(current);
    previous.searchParams.delete("assetVersion");
    expect(current.href).not.toBe(previous.href);
    expect(current.searchParams.get("assetVersion")).toBe("2");
    const draft = new URL(buildRenderUrl("tpl_design", { projectId: "prj_1234567890abcdef", draft: true }, row), origin);
    expect(draft.searchParams.get("draft")).toBe("1");
    expect(draft.searchParams.has("assetVersion")).toBe(false);
  });

  it("keeps render identities stable when SKUs change or are duplicated", () => {
    const product = shopifyProduct();
    const before = mapProductToRows(product, origin, "EUR");
    product.variants.forEach(v => { v.sku = "DUPLICATE"; });
    const after = mapProductToRows(product, origin, "EUR");
    expect(after.map(r => r.id)).toEqual(["DUPLICATE", "DUPLICATE"]);
    expect(after.map(r => r.source_id)).toEqual(before.map(r => r.source_id));
    const urls = after.map(r => buildRenderUrl("template", origin, r));
    expect(new Set(urls).size).toBe(2);
    const selected = selectRenderProduct(after, { productId: "shopify:variant:102", handle: null });
    expect(selected).toMatchObject({ title: "Mug - Large", price: "20.00 EUR" });
    expect(() => selectRenderProduct(after, { productId: null, handle: "DUPLICATE" })).toThrow("multiple variants");
    expect(rowsToCsv(after).split("\n")[0]).not.toContain("source_id");
  });

  it("uses the variant image and lands on the selected variant", () => {
    const rows = mapProductToRows(shopifyProduct(), origin, "EUR");
    expect(rows.map(r => r.image_link)).toEqual(["https://images.example/small.png", "https://images.example/large.png"]);
    expect(rows[1].link).toBe(`${origin}/products/mug?variant=102`);
    expect(resolveBinding("{{handle}}", rows[1])).toBe("mug");
  });

  it("uses the verified currency and does not invent a vendor or tea category", () => {
    const product = { ...shopifyProduct(), vendor: "", product_type: "Mugs" };
    const [row] = mapProductToRows(product, origin, "USD");
    expect(row).toMatchObject({ price: "10.00 USD", brand: "", google_product_category: "" });
  });

  it("prefers featured images and falls back when variant images are absent", () => {
    const product = shopifyProduct();
    product.variants[1].featured_image = { src: "//images.example/featured.png" };
    expect(mapProductToRows(product, origin, "EUR")[1].image_link).toBe("https://images.example/featured.png");
    product.variants[1].featured_image = null;
    product.images.forEach(image => { image.variant_ids = []; });
    product.variants[1].image_id = 2;
    expect(mapProductToRows(product, origin, "EUR")[1].image_link).toBe("https://images.example/large.png");
    product.variants[1].image_id = null;
    expect(mapProductToRows(product, origin, "EUR")[1].image_link).toBe("https://images.example/small.png");
    product.images = [];
    expect(mapProductToRows(product, origin, "EUR")[1].image_link).toBe("");
  });

  it("uses WooCommerce product IDs independently of SKU characters", () => {
    const row = wooProductToRow(wooProduct(), "Fixture");
    const url = new URL(buildRenderUrl("tpl_123", origin, row), origin);
    expect(url.searchParams.get("productId")).toBe("woocommerce:product:201");
    expect(selectRenderProduct([row], { productId: url.searchParams.get("productId"), handle: null })).toEqual(row);
    const changed = wooProductToRow({ ...wooProduct(), sku: "RENAMED" }, "Fixture");
    expect(buildRenderUrl("tpl_123", origin, changed)).toBe(url.pathname + url.search);
  });

  it("keeps the discount amount in the product currency", () => {
    const row = { ...wooProductToRow({ ...wooProduct(), on_sale: true, prices: { currency_code: "USD", currency_minor_unit: 2, price: "1000", regular_price: "1500", sale_price: "1000" } }, "Fixture") };
    expect(resolveBinding("{{discount_amount}}", row)).toBe("5.00 USD");
  });

  it("supports older cached previews without source metadata or safe SKU characters", () => {
    const row = wooProductToRow(wooProduct(), "Fixture");
    const cachedRow = { ...row, source_id: undefined };
    const url = new URL(buildRenderUrl("tpl+special", origin, cachedRow), origin);
    expect(url.searchParams.get("templateId")).toBe("tpl+special");
    expect(url.searchParams.get("handle")).toBe(row.id);
    expect(selectRenderProduct([row], { productId: null, handle: url.searchParams.get("handle") })).toEqual(row);
  });

  it("does not substitute a legacy handle for an unknown explicit ID", () => {
    const rows = mapProductToRows(shopifyProduct(), origin, "EUR");
    expect(() => selectRenderProduct(rows, { productId: "shopify:variant:999", handle: "mug" })).toThrow("Product not found");
    expect(() => selectRenderProduct(rows, { productId: "", handle: "mug" })).toThrow("Empty");
  });

  it("rejects ambiguous handles and matches complete slugs only", () => {
    const rows = mapProductToRows(shopifyProduct(), origin, "EUR");
    expect(() => selectRenderProduct(rows, { productId: null, handle: "mug" })).toThrow("multiple variants");
    expect(() => selectRenderProduct(rows, { productId: null, handle: "mu" })).toThrow("Product not found");
    expect(() => selectRenderProduct(rows, { productId: null, handle: "%" })).toThrow("Product not found");
    expect(selectRenderProduct(rows, { productId: null, handle: rows[1].link })).toEqual(rows[1]);
    expect(selectRenderProduct([rows[0]], { productId: null, handle: "mug" })).toEqual(rows[0]);
  });
});
