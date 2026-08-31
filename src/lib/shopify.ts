export type ShopifyVariant = {
  id: number;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  requires_shipping: boolean;
  available: boolean;
  price: string;
  compare_at_price: string | null;
  grams: number;
  barcode: string | null;
};

export type ShopifyImage = {
  src: string;
  width: number;
  height: number;
  position: number;
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  published_at: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: { name: string; position: number; values: string[] }[];
};

export function normalizeDomain(input: string): string {
  let s = input.trim();
  if (!s) throw new Error("Empty domain");
  // allow handle like "store.gibun.at" or "https://store.gibun.at/collections/all"
  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    s = "https://" + s;
  }
  const url = new URL(s);
  // Only keep origin + maybe we want to ensure no path
  // Shopify stores sometimes live at subdirectory? No, origin is enough for products.json
  return url.origin;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export { stripHtml };

export async function fetchShopifyProducts(rawDomain: string): Promise<ShopifyProduct[]> {
  const origin = normalizeDomain(rawDomain);
  const all: ShopifyProduct[] = [];
  let page = 1;
  const limit = 250;

  while (true) {
    const url = `${origin}/products.json?limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CatalogForge/1.0 (+https://catalog-forge)",
        Accept: "application/json",
      },
      // Cache for 5 minutes on edge
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      if (page === 1) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to fetch Shopify products from ${url}: ${res.status} ${res.statusText} ${text.slice(0, 200)}`
        );
      }
      break;
    }

    const data = (await res.json()) as { products: ShopifyProduct[] };
    if (!data.products || data.products.length === 0) break;

    all.push(...data.products);

    if (data.products.length < limit) break;
    page += 1;

    // Safety: prevent infinite loop
    if (page > 20) break;
  }

  return all;
}

export function isPhysicalProduct(product: ShopifyProduct): boolean {
  // Workshops/events in Gibun are flagged with requires_shipping=false on all variants
  const hasShippableVariant = product.variants.some((v) => v.requires_shipping);
  if (!hasShippableVariant) return false;

  // Extra heuristic: tags or title containing workshop/tasting
  const title = product.title.toLowerCase();
  if (title.includes("workshop") || title.includes("tasting") || title.includes("event")) {
    // if any variant requires shipping false, treat as non-physical
    // but some real products might have workshop in title accidentally - be conservative
    // For Gibun, workshops all have requires_shipping false anyway so already filtered
  }

  return true;
}

export function getFilteredProducts(products: ShopifyProduct[]): ShopifyProduct[] {
  return products.filter(isPhysicalProduct);
}
