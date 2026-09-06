import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/shopify";
import { detectPlatform, helpForDetection } from "@/lib/platform";
import { getClientIp, checkRateLimit, isAuthenticated } from "@/lib/auth";
import { fetchStoreCatalog } from "@/lib/storeCatalog";
import { validateCatalog } from "@/lib/catalogValidation";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Not signed in — POST /api/login first", loginRequired: true }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`preview:${ip}`, 30);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited — 30 previews/min per IP" }, { status: 429 });

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
    const catalog = await fetchStoreCatalog(origin);
    const validation = validateCatalog(catalog.rows, { importComplete: catalog.complete });
    return NextResponse.json(
      {
        domain: origin,
        platform: catalog.platform,
        totalFetched: catalog.totalFetched,
        totalPhysical: catalog.totalProducts,
        totalVariants: catalog.rows.length,
        issues: validation.issues.filter((issue) => issue.severity !== "info").map((issue) => `${issue.count} × ${issue.message}`),
        validation,
        preview: catalog.rows.slice(0, 50),
        diagnostics: {
          importComplete: catalog.complete,
          currencyCodes: catalog.currencyCodes,
          currencySource: catalog.currencySource,
          ...(catalog.platform === "woocommerce" ? { note: "Variable products preview as one parent row because the public Store API omits variations." } : {}),
        },
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const detection = await detectPlatform(origin);
      const { code, title, help } = helpForDetection(detection, origin);
      return NextResponse.json(
        {
          error: title,
          detail: message.slice(0, 300),
          code,
          platform: detection.platform,
          platformDetail: detection.detail,
          help,
          domain: origin,
        },
        { status: 502 }
      );
    } catch {
      return NextResponse.json({ error: message, domain: origin }, { status: 502 });
    }
  }
}
