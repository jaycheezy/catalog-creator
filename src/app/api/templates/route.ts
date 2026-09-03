import { NextRequest, NextResponse } from "next/server";
import { saveTemplate, getTemplate, listTemplates } from "@/lib/templateStore";
import { isAuthenticated, newTemplateId, sanitizeTemplateId } from "@/lib/auth";
import type { Template } from "@/editor/types";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not signed in — POST /api/login first", loginRequired: true }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const list = req.nextUrl.searchParams.get("list");

  // Public read by unguessable ID — Meta/server fetches need no auth (capability URL).
  if (id) {
    const clean = sanitizeTemplateId(id);
    if (!clean) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const t = await getTemplate(clean);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(t, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
  if (list !== null) {
    if (!(await isAuthenticated(req))) return unauthorized();
    const all = await listTemplates();
    return NextResponse.json({ templates: all });
  }
  return NextResponse.json({ error: "Use ?id=xxx or ?list=1" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return unauthorized();
  let body: Template;
  try {
    body = (await req.json()) as Template;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.layers || !body.width || !body.height) {
    return NextResponse.json({ error: "Missing required fields: layers, width, height" }, { status: 400 });
  }
  // Enforce unguessable IDs so feed/render URLs are safe to expose to Meta.
  const clean = sanitizeTemplateId(body.id);
  body.id = clean && clean.length >= 12 ? clean : newTemplateId();
  body.updatedAt = Date.now();
  await saveTemplate(body);
  const feedUrl = `${req.nextUrl.origin}/api/feed?domain=store.gibun.at&templateId=${encodeURIComponent(body.id)}`;
  return NextResponse.json({ ok: true, id: body.id, feedUrl });
}
