import { NextRequest, NextResponse } from "next/server";
import { saveTemplate, getTemplate, listTemplates } from "@/lib/templateStore";
import type { Template } from "@/editor/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const list = req.nextUrl.searchParams.get("list");
  if (id) {
    const t = await getTemplate(id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(t, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
  if (list !== null) {
    const all = await listTemplates();
    return NextResponse.json({ templates: all });
  }
  return NextResponse.json({ error: "Use ?id=xxx or ?list=1" }, { status: 400 });
}

export async function POST(req: NextRequest) {
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
  return NextResponse.json({ ok: true, id: body.id });
}
