import { NextRequest, NextResponse } from "next/server";
import { getTemplate, saveTemplate } from "@/lib/templateStore";
import { isAuthenticated } from "@/lib/auth";
import { HOMEPAGE_SLOTS, defaultSlotTemplate, isCustomized, isHomepageSlotId } from "@/lib/homepageTemplates";
import { durableStorageMessage, DurableStorageError } from "@/lib/durableStorage";
import type { Template } from "@/editor/types";

export const runtime = "nodejs";

// GET /api/homepage-templates → the three showcase slots behind the `/` hero.
// Requires auth (same gate as the template list). Slots without a stored
// record resolve to their demo defaults WITHOUT writing anything.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Not signed in", loginRequired: true }, { status: 401 });
  }
  try {
    const slots = await Promise.all(
      HOMEPAGE_SLOTS.map(async (slot) => {
        const stored = await getTemplate(slot.id);
        const template = stored ?? defaultSlotTemplate(slot.id);
        return {
          id: slot.id,
          label: slot.label,
          template,
          customized: stored ? isCustomized(stored, slot.id) : false,
          revision: stored?.revision ?? 0,
          updatedAt: stored?.updatedAt ?? null,
        };
      })
    );
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(durableStorageMessage(error), { status: 503 });
  }
}

// PUT /api/homepage-templates { id } → reset one slot to its demo default.
// Full visual editing happens in /editor?templateId=<slot-id>, which saves
// straight back to the template store under the same id.
export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Not signed in", loginRequired: true }, { status: 401 });
  }
  let id: unknown;
  try {
    id = ((await req.json()) as { id?: unknown }).id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isHomepageSlotId(id)) {
    return NextResponse.json({ error: "Unknown homepage slot id" }, { status: 400 });
  }
  try {
    const existing = await getTemplate(id);
    const now = Date.now();
    const template: Template = {
      ...defaultSlotTemplate(id),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revision: (existing?.revision ?? 0) + 1,
    };
    await saveTemplate(template);
    return NextResponse.json({ ok: true, id, revision: template.revision });
  } catch (error) {
    const payload = durableStorageMessage(error);
    return NextResponse.json(payload, { status: error instanceof DurableStorageError ? 503 : 500 });
  }
}
