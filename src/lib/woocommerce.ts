import { stripHtml, normalizeDomain } from "./shopify";
import type { FeedRow } from "./facebook";

/**
 * WooCommerce support via the public Store API (no auth needed):
 *   GET {origin}/wp-json/wc/store/v1/products?per_page=100&page=N
 *
 * Notes:
 * - Prices arrive in minor units: prices.price "1105" + currency_minor_unit 2 = 11.05.
 * - Variable products come back as one parent row (variations need the
 *   authenticated wc/v3 API, so we preview the parent).
 * - Brand isn't a Store API concept — callers pass a fallback (store name).
 */

export type WooPrices = {
  currency_code?: string;
  currency_minor_unit?: number;
  price?: string;
  regular_price?: string;
  sale_price?: string;
};

export type WooImage = {
  id?: number;
  src?: string;
  thumbnail?: string;
  name?: string;
  alt?: string;
};

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  short_description?: string;
  description?: string;
  prices?: WooPrices;
  on_sale?: boolean;
  images?: WooImage[];
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  categories?: { id: number; name: string; slug: string }[];
  average_rating?: string;
};

export { normalizeDomain };

const WOO_PER_PAGE = 100;
const WOO_MAX_PAGES = 5; // 500 products is plenty for preview/feed

export async function fetchWooProducts(rawDomain: string, maxPages = WOO_MAX_PAGES): Promise<WooProduct[]> {
  const origin = normalizeDomain(rawDomain);
  const all: WooProduct[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${origin}/wp-json/wc/store/v1/products?per_page=${WOO_PER_PAGE}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CatalogForge/1.0 (+https://catalog-forge)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      if (page === 1) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Woo Store API unavailable at ${url}: ${res.status} ${res.statusText} ${text.slice(0, 200)}`
        );
      }
      break;
    }

    const data = (await res.json()) as WooProduct[];
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < WOO_PER_PAGE) break;
  }

  return all;
}

function formatMinorUnits(raw: string | undefined, minorUnit: number, currency: string): string {
  if (raw == null || raw === "") return "";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return "";
  return `${(n / Math.pow(10, minorUnit)).toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

export function prettyBrandFromOrigin(origin: string, fallback = ""): string {
  const host = origin.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  const base = host.split(".")[0] || host;
  const pretty = base.charAt(0).toUpperCase() + base.slice(1);
  return fallback || pretty;
}

export function wooProductToRow(p: WooProduct, brandFallback: string): FeedRow {
  const prices = p.prices ?? {};
  const minorUnit = prices.currency_minor_unit ?? 2;
  const currency = (prices.currency_code || "").toUpperCase();

  // Mirror the Shopify mapping: price = compare-at, sale_price = actual.
  const regular = formatMinorUnits(prices.regular_price, minorUnit, currency);
  const sale = formatMinorUnits(prices.sale_price, minorUnit, currency);
  const current = formatMinorUnits(prices.price, minorUnit, currency);
  let price = current || regular;
  let sale_price = "";
  if (p.on_sale && regular && sale && regular !== sale) {
    price = regular;
    sale_price = sale;
  }

  const description = stripHtml(p.short_description || p.description).slice(0, 5000) || p.name;
  const image = p.images?.[0]?.src || "";
  const additional = (p.images ?? [])
    .slice(1, 5)
    .map((i) => i.src || "")
    .filter(Boolean)
    .join(",");

  return {
    id: (p.sku && p.sku.trim() !== "" ? p.sku.trim() : String(p.id)).slice(0, 100),
    source_id: `woocommerce:product:${p.id}`,
    // Store API names can contain HTML entities (e.g. Dovetail &#038; …).
    title: (stripHtml(p.name) || "Untitled").slice(0, 150),
    description,
    availability: p.is_in_stock === false ? "out of stock" : "in stock",
    condition: "new",
    price,
    link: p.permalink || "",
    image_link: image,
    brand: brandFallback.slice(0, 70),
    additional_image_link: additional,
    item_group_id: "",
    // Woo has no Google taxonomy — pass the store category through, leave blank if none.
    google_product_category: (p.categories?.[0]?.name || "").slice(0, 200),
    sale_price,
    inventory: "",
  };
}

export function wooProductsToRows(products: WooProduct[], origin: string, brandFallback?: string): FeedRow[] {
  const brand = prettyBrandFromOrigin(origin, brandFallback);
  return products.map((p) => wooProductToRow(p, brand));
}
