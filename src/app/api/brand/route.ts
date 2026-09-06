import { NextRequest, NextResponse } from "next/server";
import { heuristicBrandKit } from "@/lib/brand";

// GET /api/brand?domain=store.gibun.at
// Tries context.dev brand intelligence when CONTEXT_API_KEY is set,
// otherwise falls back to a local heuristic (favicon + hashed accent).
// Public by design: only returns non-sensitive brand display data.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("domain") || "";
  const domain = raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").trim();
  if (!domain) return NextResponse.json({ error: "Missing ?domain=" }, { status: 400 });

  const key = process.env.CONTEXT_API_KEY;
  if (key) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      // context.dev Retrieve Brand — see https://docs.context.dev
      const res = await fetch(`https://api.context.dev/v1/brand?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const j = (await res.json()) as Record<string, unknown>;
        const name = (j.name || j.brand || j.company) as string | undefined;
        const colors = (j.colors || j.brandColors) as string[] | undefined;
        const logo = (j.logo || j.logoUrl || j.icon) as string | undefined;
        const accent = colors?.[0] && /^#([0-9a-f]{6})$/i.test(String(colors[0])) ? String(colors[0]) : undefined;
        const base = heuristicBrandKit(domain, name);
        return NextResponse.json(
          {
            ...base,
            ...(name ? { name } : {}),
            ...(accent ? { accent, softBg: `${accent}14` } : {}),
            ...(logo ? { logoUrl: logo } : {}),
            source: "context.dev",
          },
          { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
        );
      }
    } catch {
      // fall through to heuristic
    }
  }

  return NextResponse.json(heuristicBrandKit(domain), {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
  });
}
