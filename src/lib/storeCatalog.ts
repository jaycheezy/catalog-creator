import { fetchShopifyCurrency, fetchShopifyProducts, getFilteredProducts, type ShopifyProduct } from "./shopify";
import { fetchWooProducts, wooProductsToRows } from "./woocommerce";
import { productsToRows, type FeedRow } from "./facebook";

/** Feed generation and image rendering must use exactly the same catalog. */
export type StoreCatalog = {
  rows: FeedRow[];
  totalProducts: number;
  platform: "shopify" | "woocommerce";
  complete: boolean;
  totalFetched: number;
  currencyCodes: string[];
  currencySource: "shopify-cart" | "woocommerce-api" | "missing";
};

export async function fetchStoreCatalog(origin: string): Promise<StoreCatalog> {
  let shopify: ShopifyProduct[] = [];
  try {
    shopify = await fetchShopifyProducts(origin);
  } catch {
    // Stores without a public Shopify endpoint may expose the Woo Store API.
  }
  if (shopify.length > 0) {
    const products = getFilteredProducts(shopify);
    const currency = await fetchShopifyCurrency(origin);
    return {
      rows: productsToRows(products, origin, currency || ""),
      totalProducts: products.length,
      platform: "shopify",
      complete: shopify.length < 5_000,
      totalFetched: shopify.length,
      currencyCodes: currency ? [currency] : [],
      currencySource: currency ? "shopify-cart" : "missing",
    };
  }
  const woo = await fetchWooProducts(origin);
  if (woo.length === 0) throw new Error("No products via Shopify (/products.json) or WooCommerce (/wp-json/wc/store/v1)");
  return {
    rows: wooProductsToRows(woo, origin),
    totalProducts: woo.length,
    platform: "woocommerce",
    complete: woo.length < 500,
    totalFetched: woo.length,
    currencyCodes: Array.from(new Set(woo.flatMap((product) => {
      const code = product.prices?.currency_code?.trim().toUpperCase();
      return code ? [code] : [];
    }))).sort(),
    currencySource: woo.some((product) => product.prices?.currency_code) ? "woocommerce-api" : "missing",
  };
}
