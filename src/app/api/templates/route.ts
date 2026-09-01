import { NextRequest, NextResponse } from "next/server";
import { saveTemplate, getTemplate, listTemplates } from "@/lib/templateStore";
import { getSecret, isAuthorized, signTemplateId } from "@/lib/auth";
import type { Template } from "@/editor/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = await getSecret();
  const id = req.nextUrl.searchParams.get("id");
  const list = req.nextUrl.searchParams.get("list");
  const sign = req.nextUrl.searchParams.get("sign");
  // Optional signed URL helper: ?id=xxx&sign=1&domain=store.gibun.at returns token
  if (id && sign !== null) {
    const domain = req.nextUrl.searchParams.get("domain") || "";
    if (secret) {
      const token = await signTemplateId(id, secret);
      const origin = req.nextUrl.origin;
      const feedUrl = `${origin}/api/feed?domain=${encodeURIComponent(domain || "store.gibun.at")}&templateId=${encodeURIComponent(id)}&token=${token}`;
      const renderUrl = `${origin}/api/render?templateId=${encodeURIComponent(id)}&handle=NOT_MY_HANDLE&domain=${encodeURIComponent(domain || "store.gibun.at")}&token=${token}`;
      return NextResponse.json({ id, token, feedUrl, renderUrlTemplate: renderUrl });
    }
    return NextResponse.json({ id, token: null, note: "No API_SECRET set — feed is public in dev" });
  }
  if (id) {
    // Allow internal fetch from render/feed (edge) to read template without key if token present? For now require key if secret set
    const token = req.nextUrl.searchParams.get("token");
    // If token is valid, allow read without API key
    if (secret && token) {
      const { verifyTemplateToken } = await import("@/lib/auth");
      if (!(await verifyTemplateToken(id, token, secret))) {
        // fall through to API key check
      } else {
        const t = await getTemplate(id);
        if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(t, { headers: { "Cache-Control": "public, s-maxage=60" } });
      }
    }
    if (secret && !(await isAuthorized(req, secret))) {
      return NextResponse.json({ error: "Unauthorized — set x-api-key header" }, { status: 401 });
    }
    const t = await getTemplate(id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(t, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
  if (list !== null) {
    if (secret && !(await isAuthorized(req, secret))) {
      return NextResponse.json({ error: "Unauthorized — set x-api-key header" }, { status: 401 });
    }
    const all = await listTemplates();
    return NextResponse.json({ templates: all });
  }
  return NextResponse.json({ error: "Use ?id=xxx or ?list=1 or ?id=xxx&sign=1&domain=..." }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const secret = await getSecret();
  if (secret && !(await isAuthorized(req, secret))) {
    return NextResponse.json({ error: "Unauthorized — missing or invalid x-api-key. Set API_SECRET via wrangler secret put." }, { status: 401 });
  }
  let body: Template;
  try {
    body = (await req.json()) as Template;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || !body.layers || !body.width || !body.height) {
    return NextResponse.json({ error: "Missing required fields: id, layers, width, height" }, { status: 400 });
  }
  body.updatedAt = Date.now();
  await saveTemplate(body);
  // If secret set, also return signed URLs for immediate use
  let token: string | null = null;
  let feedUrl: string | null = null;
  if (secret) {
    token = await signTemplateId(body.id, secret);
    feedUrl = `${req.nextUrl.origin}/api/feed?domain=store.gibun.at&templateId=${encodeURIComponent(body.id)}&token=${token}`;
  }
  return NextResponse.json({ ok: true, id: body.id, token, feedUrl });
}
