import { NextRequest, NextResponse } from "next/server";
import { fetchShopifyProducts, getFilteredProducts, normalizeDomain } from "@/lib/shopify";
import { productsToRows, getValidationIssues } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") || req.nextUrl.searchParams.get("store") || "";

  if (!domain) {
    return NextResponse.json({ error: "Missing ?domain= parameter. Example: ?domain=store.gibun.at" }, { status: 400 });
  }

  let origin: string;
  try {
    origin = normalizeDomain(domain);
  } catch {
    return NextResponse.json({ error: `Invalid domain: ${domain}` }, { status: 400 });
  }

  try {
    const products = await fetchShopifyProducts(origin);
    const filtered = getFilteredProducts(products);
    const rows = productsToRows(filtered, origin);
    const issues = getValidationIssues(rows);

    return NextResponse.json(
      {
        domain: origin,
        totalFetched: products.length,
        totalPhysical: filtered.length,
        totalVariants: rows.length,
        issues,
        preview: rows.slice(0, 50),
        diagnostics: {
          filteredOut: products.length - filtered.length,
          sampleFilteredOut: products.filter((p) => !filtered.includes(p)).slice(0, 5).map((p) => ({
            title: p.title,
            handle: p.handle,
            requires_shipping: p.variants[0]?.requires_shipping,
          })),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, domain: origin }, { status: 502 });
  }
}
