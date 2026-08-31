import { ShopifyProduct, stripHtml } from "./shopify";

export type FeedRow = {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "used" | "refurbished";
  price: string; // e.g. "17.90 EUR"
  link: string;
  image_link: string;
  brand: string;
  additional_image_link?: string;
  item_group_id?: string;
  google_product_category?: string;
  sale_price?: string;
  inventory?: string;
};

const FB_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "additional_image_link",
  "item_group_id",
  "google_product_category",
  "sale_price",
  "inventory",
];

function ensureHttps(url: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http://")) return "https://" + url.slice(7);
  return url;
}

function formatPrice(price: string, compareAtPrice: string | null): { price: string; sale_price: string } {
  const p = parseFloat(price);
  const formatted = `${p.toFixed(2)} EUR`;
  if (compareAtPrice) {
    const cap = parseFloat(compareAtPrice);
    if (!isNaN(cap) && cap > p) {
      return { price: `${cap.toFixed(2)} EUR`, sale_price: formatted };
    }
  }
  return { price: formatted, sale_price: "" };
}

function csvEscape(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function mapProductToRows(product: ShopifyProduct, origin: string): FeedRow[] {
  const cleanDescription = stripHtml(product.body_html).slice(0, 5000) || product.title;
  const brand = product.vendor || "Gibun";

  return product.variants.map((variant) => {
    // Use SKU as id if present, else variant.id (Facebook id must be unique & stable)
    const id = variant.sku && variant.sku.trim() !== "" ? variant.sku.trim() : String(variant.id);
    const title =
      product.variants.length > 1 && variant.title !== "Default Title"
        ? `${product.title} - ${variant.title}`.slice(0, 150)
        : product.title.slice(0, 150);

    const { price, sale_price } = formatPrice(variant.price, variant.compare_at_price);
    const link = `${origin}/products/${product.handle}`;
    const imageRaw = product.images[0]?.src || "";
    const image_link = ensureHttps(imageRaw);
    const additional = product.images
      .slice(1, 5)
      .map((i) => ensureHttps(i.src))
      .filter(Boolean)
      .join(",");

    // Default google category for tea - user can override later
    const google_product_category = "Food, Beverages & Tobacco > Beverages > Tea";

    return {
      id,
      title,
      description: cleanDescription.slice(0, 5000),
      availability: variant.available ? "in stock" : "out of stock",
      condition: "new",
      price,
      link,
      image_link,
      brand: brand.slice(0, 70),
      additional_image_link: additional,
      item_group_id: product.variants.length > 1 ? String(product.id) : "",
      google_product_category,
      sale_price,
      inventory: "", // leave blank unless quantity tracking needed
    };
  });
}

export function productsToRows(products: ShopifyProduct[], origin: string): FeedRow[] {
  return products.flatMap((p) => mapProductToRows(p, origin));
}

export function rowsToCsv(rows: FeedRow[]): string {
  const header = FB_HEADERS.join(",");
  const lines = rows.map((row) =>
    FB_HEADERS.map((h) => csvEscape((row as Record<string, string>)[h] ?? "")).join(",")
  );
  return [header, ...lines].join("\n");
}

export function getValidationIssues(rows: FeedRow[]): string[] {
  const issues: string[] = [];
  if (rows.length === 0) issues.push("No products to export after filtering.");
  const missingImages = rows.filter((r) => !r.image_link).length;
  if (missingImages > 0) issues.push(`${missingImages} variants missing image_link (required by Facebook).`);
  const missingPrice = rows.filter((r) => !r.price).length;
  if (missingPrice > 0) issues.push(`${missingPrice} variants missing price.`);
  return issues;
}

export { FB_HEADERS };
