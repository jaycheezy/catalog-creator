/**
 * Lightweight platform detection for retailer URLs.
 *
 * Goal: turn a cryptic `Failed to fetch ... 404` into
 * "Looks like WooCommerce — here's what to do next".
 *
 * No new dependencies, short timeouts, best-effort only.
 */

export type PlatformId =
  | "shopify"
  | "woocommerce"
  | "wix"
  | "squarespace"
  | "magento"
  | "bigcommerce"
  | "shopware"
  | "custom"
  | "unknown";

export type PlatformDetection = {
  platform: PlatformId;
  /** high = strong signal (API responded), medium = HTML markers, low = guess */
  confidence: "high" | "medium" | "low";
  detail: string;
  /** true when the store looks like Shopify but /products.json is closed */
  shopifyBlocked?: boolean;
};

export type PreviewErrorCode =
  | "UNSUPPORTED_PLATFORM"
  | "SHOPIFY_BLOCKED"
  | "SHOPIFY_EMPTY"
  | "FETCH_FAILED"
  | "INVALID_DOMAIN";

const FETCH_TIMEOUT_MS = 7000;

function timeoutSignal(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

async function fetchText(url: string, ms = FETCH_TIMEOUT_MS): Promise<{ status: number; text: string } | null> {
  const { signal, done } = timeoutSignal(ms);
  try {
    const res = await fetch(url, {
      signal,
      headers: {
        "User-Agent": "CatalogForge/1.0 (+https://catalog-forge)",
        Accept: "text/html,application/json,*/*",
      },
      redirect: "follow",
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } catch {
    return null;
  } finally {
    done();
  }
}

function sniffHtmlPlatform(html: string): PlatformId | null {
  const h = html.toLowerCase();
  if (h.includes("cdn.shopify.com") || h.includes("myshopify.com") || h.includes("shopify.theme") || h.includes("shopify-features")) return "shopify";
  if (h.includes("woocommerce") || h.includes("wp-content/plugins/woocommerce") || h.includes("wc-ajax=get_refreshed_fragments")) return "woocommerce";
  if (h.includes("wix.com") || h.includes("wixstatic.com") || h.includes('generator" content="wix')) return "wix";
  if (h.includes("squarespace") || h.includes("sqspcdn.com") || h.includes('generator" content="squarespace')) return "squarespace";
  if (h.includes("magento") || h.includes("mage/cookies") || h.includes("static/version") && h.includes("magento")) return "magento";
  if (h.includes("bigcommerce") || h.includes("cdn11.bigcommerce.com")) return "bigcommerce";
  if (h.includes("shopware") || h.includes("/bundles/storefront/assets")) return "shopware";
  return null;
}

export function platformLabel(p: PlatformId): string {
  switch (p) {
    case "shopify": return "Shopify";
    case "woocommerce": return "WooCommerce";
    case "wix": return "Wix";
    case "squarespace": return "Squarespace";
    case "magento": return "Magento / Adobe Commerce";
    case "bigcommerce": return "BigCommerce";
    case "shopware": return "Shopware";
    case "custom": return "custom / headless storefront";
    case "unknown": return "this store";
  }
}

/**
 * Probe a store origin. Cheap and best-effort:
 *  1. /products.json?limit=1 → Shopify open (high confidence)
 *  2. homepage HTML markers → platform guess (medium)
 *  3. /wp-json/wc/store/v1/products → Woo Store API open (high)
 */
export async function detectPlatform(origin: string): Promise<PlatformDetection> {
  // 1. Shopify open?
  const shop = await fetchText(`${origin}/products.json?limit=1`, 6000);
  if (shop && shop.status === 200) {
    try {
      const j = JSON.parse(shop.text) as { products?: unknown };
      if (Array.isArray(j.products)) {
        return { platform: "shopify", confidence: "high", detail: "/products.json is open" };
      }
    } catch { /* HTML with 200 — fall through */ }
    // 200 but not JSON: could be password page / headless 200-404
    if (/password|enter store|opening soon/i.test(shop.text.slice(0, 4000))) {
      return { platform: "shopify", confidence: "medium", detail: "storefront password page detected", shopifyBlocked: true };
    }
  }
  if (shop && (shop.status === 401 || shop.status === 403 || shop.status === 404)) {
    // Might still be Shopify with the endpoint disabled — check homepage before concluding.
    const home = await fetchText(origin, 7000);
    const sniffed: PlatformId | null = home ? sniffHtmlPlatform(home.text) : null;
    if (sniffed === "shopify") {
      return { platform: "shopify", confidence: "medium", detail: `/products.json returned ${shop.status} — endpoint disabled or headless`, shopifyBlocked: true };
    }
    if (sniffed) {
      return { platform: sniffed, confidence: "medium", detail: `homepage markers (${sniffed}); /products.json → ${shop.status}` };
    }
  }

  // 2. Homepage markers (parallel with Woo Store API probe)
  const [homeRes, wooRes] = await Promise.all([
    fetchText(origin, 7000),
    fetchText(`${origin}/wp-json/wc/store/v1/products?per_page=1`, 6000),
  ]);

  if (wooRes && wooRes.status === 200) {
    try {
      const j = JSON.parse(wooRes.text);
      if (Array.isArray(j)) {
        return { platform: "woocommerce", confidence: "high", detail: "Woo Store API is open (/wp-json/wc/store/v1)" };
      }
    } catch { /* ignore */ }
  }

  if (homeRes) {
    const sniffed = sniffHtmlPlatform(homeRes.text);
    if (sniffed) return { platform: sniffed, confidence: "medium", detail: `homepage markers (${sniffed})` };
    if (homeRes.status === 200 && homeRes.text.length > 500) {
      return { platform: "custom", confidence: "low", detail: "no known platform markers found" };
    }
  }

  return { platform: "unknown", confidence: "low", detail: "store unreachable or no markers" };
}

export function helpForDetection(d: PlatformDetection, origin: string): { code: PreviewErrorCode; title: string; help: string } {
  if (d.platform === "shopify" && d.shopifyBlocked) {
    return {
      code: "SHOPIFY_BLOCKED",
      title: `This Shopify store blocks auto-import`,
      help: `We found Shopify at ${origin}, but /products.json is closed (Plus/headless setting, storefront password, or bot protection). Fix: publish products to the Online Store channel and remove the storefront password — or paste a product feed URL / upload a CSV below and preview right away.`,
    };
  }
  if (d.platform === "shopify") {
    return {
      code: "FETCH_FAILED",
      title: `Couldn't read this Shopify store`,
      help: `The store didn't return products. It may be temporarily unreachable. Try again, or paste a feed URL / upload a CSV to continue.`,
    };
  }
  if (d.platform === "woocommerce") {
    return {
      code: "UNSUPPORTED_PLATFORM",
      title: `This WooCommerce store blocks auto-import`,
      help: `We support WooCommerce via the public Store API, but ${origin} didn't return products (${d.detail}). Common causes: a security plugin blocking /wp-json, "disable REST API" setting, or bot protection. Fix: allow /wp-json/wc/store/v1/products — or paste a product feed URL / upload a CSV below and preview right away.`,
    };
  }
  if (d.platform === "wix" || d.platform === "squarespace" || d.platform === "magento" || d.platform === "bigcommerce" || d.platform === "shopware") {
    return {
      code: "UNSUPPORTED_PLATFORM",
      title: `Looks like ${platformLabel(d.platform)} — auto-import isn't supported yet`,
      help: `We auto-import Shopify today (${d.detail}). For ${platformLabel(d.platform)} the fastest path is: paste your Google Shopping / Facebook feed URL, or upload your product CSV — you'll get the same phone preview.`,
    };
  }
  return {
    code: d.platform === "unknown" ? "FETCH_FAILED" : "UNSUPPORTED_PLATFORM",
    title: d.platform === "unknown" ? `Couldn't reach ${origin}` : `This ${platformLabel(d.platform)} isn't auto-supported yet`,
    help: `Check the URL (root domain is enough, e.g. store.gibun.at) — or skip auto-import: paste a feed URL or upload a CSV to preview immediately.`,
  };
}
