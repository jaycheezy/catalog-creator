import { NextRequest, NextResponse } from "next/server";
import { saveTemplate, getTemplate, listTemplates } from "@/lib/templateStore";
import { isAuthenticated, newTemplateId, sanitizeTemplateId } from "@/lib/auth";
import type { Template } from "@/editor/types";
import { durableStorageMessage, DurableStorageError } from "@/lib/durableStorage";

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
    try {
      const t = await getTemplate(clean);
      if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(t, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json(durableStorageMessage(error), { status: 503 });
    }
  }
  if (list !== null) {
    if (!(await isAuthenticated(req))) return unauthorized();
    try {
      const all = await listTemplates();
      return NextResponse.json({ templates: all });
    } catch (error) {
      return NextResponse.json(durableStorageMessage(error), { status: 503 });
    }
  }
  return NextResponse.json({ error: "Use ?id=xxx or ?list=1" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return unauthorized();
  let body: Template & { expectedRevision?: number };
  try {
    body = (await req.json()) as Template;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.layers || !body.width || !body.height) {
    return NextResponse.json({ error: "Missing required fields: layers, width, height" }, { status: 400 });
  }
  try {
    // Enforce unguessable IDs so feed/render URLs are safe to expose to Meta.
    const clean = sanitizeTemplateId(body.id);
    const id = clean && clean.length >= 12 ? clean : newTemplateId();
    const existing = await getTemplate(id);
    const currentRevision = existing?.revision ?? 0;
    if (body.expectedRevision !== undefined && body.expectedRevision !== currentRevision) {
      return NextResponse.json({
        error: "This template changed in another session. Reload it before saving again.",
        code: "REVISION_CONFLICT",
        retryable: false,
        revision: currentRevision,
      }, { status: 409 });
    }

    const { expectedRevision: _expectedRevision, ...templateInput } = body;
    void _expectedRevision;
    const now = Date.now();
    const template: Template = {
      ...templateInput,
      id,
      createdAt: existing?.createdAt ?? templateInput.createdAt ?? now,
      updatedAt: now,
      revision: currentRevision + 1,
    };
    await saveTemplate(template);
    const feedUrl = `${req.nextUrl.origin}/api/feed?domain=store.gibun.at&templateId=${encodeURIComponent(template.id)}`;
    return NextResponse.json({ ok: true, id: template.id, templateId: template.id, revision: template.revision, feedUrl });
  } catch (error) {
    const payload = durableStorageMessage(error);
    console.error(JSON.stringify({ event: "template_save_failed", code: payload.code }));
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }
}
