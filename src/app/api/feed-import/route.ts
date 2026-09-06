import { NextRequest, NextResponse } from "next/server";
import { FEED_PREVIEW_LIMIT } from "@/lib/feedImport";
import { importRemoteFeed, RemoteFeedError } from "@/lib/remoteFeed";
import { getClientIp, checkRateLimit, isAuthenticated } from "@/lib/auth";
import { validateCatalog } from "@/lib/catalogValidation";

// GET /api/feed-import?url=https://example.com/feed.xml
// Fetches a Google Shopping / Facebook feed (CSV or XML) server-side and
// returns the same preview shape as /api/preview so the home page phone
// preview works for non-Shopify retailers.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Not signed in — POST /api/login first", loginRequired: true }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`feed-import:${ip}`, 15);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited — 15 feed imports/min per IP" }, { status: 429 });

  const raw = req.nextUrl.searchParams.get("url") || req.nextUrl.searchParams.get("feed") || "";
  if (!raw) {
    return NextResponse.json({ error: "Missing ?url= parameter. Example: ?url=https://example.com/feed.xml" }, { status: 400 });
  }

  try {
    const { rows, format, url: feedUrl } = await importRemoteFeed(raw, FEED_PREVIEW_LIMIT);
    const importComplete = rows.length < FEED_PREVIEW_LIMIT;
    const validation = validateCatalog(rows, { importComplete });
    return NextResponse.json(
      {
        domain: feedUrl,
        source: "feed-url",
        format,
        totalFetched: rows.length,
        totalPhysical: rows.length,
        totalVariants: rows.length,
        issues: validation.issues.filter((issue) => issue.severity !== "info").map((issue) => `${issue.count} × ${issue.message}`),
        validation,
        preview: rows.slice(0, 50),
        diagnostics: { truncatedAt: FEED_PREVIEW_LIMIT, importComplete },
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof RemoteFeedError ? e.status : 502;
    return NextResponse.json(
      {
        error: message,
        help: "If the feed needs auth or blocks bots, download it and use the CSV tab instead.",
      },
      { status }
    );
  }
}
