import { NextRequest, NextResponse } from "next/server";
import { fetchShopifyProducts, getFilteredProducts, normalizeDomain } from "@/lib/shopify";
import { productsToRows, rowsToCsv } from "@/lib/facebook";
import { getSecret, verifyTemplateToken, getClientIp, checkRateLimit } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") || req.nextUrl.searchParams.get("store") || "";

  if (!domain) {
    return new NextResponse(
      "Missing ?domain= parameter. Example: /api/feed?domain=store.gibun.at\n",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  let origin: string;
  try {
    origin = normalizeDomain(domain);
  } catch {
    return new NextResponse(`Invalid domain: ${domain}\n`, { status: 400 });
  }

  const templateId = req.nextUrl.searchParams.get("templateId") || req.nextUrl.searchParams.get("template_id");
  const token = req.nextUrl.searchParams.get("token");
  const secret = await getSecret();

  // Rate limit plain preview/feed too (30/min)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`feed:${ip}`, 30);
  if (!rl.ok) return new NextResponse("Rate limited — 30 feed requests/min per IP", { status: 429, headers: { "Retry-After": "60" } });

  // If enriched feed requested, require valid token when secret is set
  if (templateId) {
    if (secret && !(await verifyTemplateToken(templateId, token, secret))) {
      return new NextResponse(`Unauthorized — missing or invalid token. GET /api/templates?id=${templateId}&sign=1&domain=${encodeURIComponent(domain)} to get signed URL.\n`, { status: 401 });
    }
    // Validate template exists (via HTTP with secret header for internal fetch)
    try {
      const headers: Record<string, string> = {};
      if (secret) headers["x-api-key"] = secret;
      const checkUrl = new URL(`/api/templates?id=${encodeURIComponent(templateId)}`, req.nextUrl.origin).toString();
      const check = await fetch(checkUrl, { headers, cache: "no-store" });
      if (!check.ok) {
        return new NextResponse(`Template not found: ${templateId}. POST it to /api/templates first.\n`, { status: 404 });
      }
    } catch {
      try {
        const { getTemplate } = await import("@/lib/templateStore");
        const t = await getTemplate(templateId);
        if (!t) return new NextResponse(`Template not found: ${templateId}. POST it to /api/templates first.\n`, { status: 404 });
      } catch {
        return new NextResponse(`Template not found: ${templateId}. POST it to /api/templates first.\n`, { status: 404 });
      }
    }
  }

  try {
    const products = await fetchShopifyProducts(origin);
    const filtered = getFilteredProducts(products);
    let rows = productsToRows(filtered, origin);

    // Enrich image_link to point to /api/render when templateId supplied (include token for auth)
    if (templateId) {
      const renderBase = `${req.nextUrl.origin}/api/render`;
      const tokenParam = secret && token ? `&token=${encodeURIComponent(token)}` : "";
      rows = rows.map((r) => {
        const handle = r.link.split("/products/")[1]?.split("?")[0] ?? "";
        const enriched = `${renderBase}?templateId=${encodeURIComponent(templateId)}&handle=${encodeURIComponent(handle)}&domain=${encodeURIComponent(origin)}${tokenParam}`;
        return { ...r, image_link: enriched };
      });
    }

    const csv = rowsToCsv(rows);

    const filename = origin.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_") + "_facebook.csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        "X-Total-Products": String(filtered.length),
        "X-Total-Variants": String(rows.length),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(`CSV generation failed for ${origin}: ${message}\n`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
