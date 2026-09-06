import type { ShopifyProduct, ShopifyVariant } from "@/lib/shopify";
import type { WooProduct } from "@/lib/woocommerce";
import type { Template } from "@/editor/types";

function variant(id: number, title: string, price: string): ShopifyVariant {
  return {
    id, title, price, sku: `MUG-${title.toUpperCase()}`, option1: title,
    option2: null, option3: null, requires_shipping: true, available: true,
    compare_at_price: null, grams: 100, barcode: null,
  };
}

export function shopifyProduct(): ShopifyProduct {
  return {
    id: 100, title: "Mug", handle: "mug", body_html: "<p>A handmade ceramic mug.</p>",
    vendor: "Fixture", product_type: "Mugs", tags: [], published_at: "2026-09-04T00:00:00Z",
    options: [{ name: "Size", position: 1, values: ["Small", "Large"] }],
    variants: [variant(101, "Small", "10.00"), variant(102, "Large", "20.00")],
    images: [
      { id: 1, src: "https://images.example/small.png", variant_ids: [101], width: 1000, height: 1000, position: 1 },
      { id: 2, src: "https://images.example/large.png", variant_ids: [102], width: 1000, height: 1000, position: 2 },
    ],
  };
}

export function wooProduct(): WooProduct {
  return {
    id: 201, name: "Coffee cup", slug: "coffee-cup", sku: "CUP / BLUE & WHITE",
    permalink: "https://store.example/product/coffee-cup/", is_in_stock: true,
    prices: { currency_code: "USD", currency_minor_unit: 2, price: "1250", regular_price: "1250" },
    images: [{ src: "https://images.example/woo-cup.png" }],
  };
}

export const template: Template = {
  id: "tpl_fixture_template", name: "Fixture", sizeId: "1:1", width: 1080, height: 1080,
  background: "#fff", createdAt: 1, updatedAt: 1,
  layers: [
    { id: "text", name: "Title and price", type: "text", x: 20, y: 20, w: 1000, h: 100,
      z: 1, rotation: 0, visible: true, locked: false, content: "{{title}} | {{price}}", style: {} },
    { id: "image", name: "Product", type: "product-image", x: 20, y: 150, w: 900, h: 900,
      z: 0, rotation: 0, visible: true, locked: false, style: {} },
  ],
};
