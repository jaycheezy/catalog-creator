import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { FeedRow } from "@/lib/facebook";
import { fetchStoreCatalog } from "@/lib/storeCatalog";

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, isAuthenticated: vi.fn(async () => true) };
});
vi.mock("@/lib/storeCatalog", () => ({ fetchStoreCatalog: vi.fn() }));

import { GET } from "@/app/api/preview/route";

function row(index: number): FeedRow {
  return {
    id: `SKU-${index}`,
    source_id: `shopify:variant:${index}`,
    title: `Product ${index}`,
    description: "A complete catalog product description.",
    availability: "in stock",
    condition: "new",
    price: "25.00 CAD",
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

describe("preview validation", () => {
  it("validates all rows even though the visual preview returns only 50", async () => {
    const rows = Array.from({ length: 75 }, (_, index) => row(index + 1));
    rows[60] = { ...rows[60], link: "/relative" };
    vi.mocked(fetchStoreCatalog).mockResolvedValue({
      rows,
      totalProducts: 75,
      totalFetched: 75,
      platform: "shopify",
      complete: true,
      currencyCodes: ["CAD"],
      currencySource: "shopify-cart",
    });

    const response = await GET(new NextRequest("https://catalog.example/api/preview?domain=shop.example"));
    const json = await response.json() as {
      preview: FeedRow[];
      validation: { status: string; issues: Array<{ code: string; rowIndexes: number[]; productIds: string[] }> };
    };
    expect(json.preview).toHaveLength(50);
    expect(json.validation.status).toBe("blocked");
    expect(json.validation.issues.find((issue: { code: string }) => issue.code === "invalid-link")).toMatchObject({
      rowIndexes: [60],
      productIds: ["SKU-61"],
    });
  });
});
