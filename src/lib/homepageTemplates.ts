import { DEMO_TEMPLATES } from "./demoTemplates";
import type { Template } from "@/editor/types";

/* Homepage showcase slots: the three designs previewed on `/`. Each slot is
   backed by a template record with a fixed, human-readable id. IDs are
   guessable by design — these are public showcase designs, not private
   campaign assets (writes always require auth; reads of drafts stay gated
   behind the normal template store rules). */

export const HOMEPAGE_SLOTS = [
  { id: "homepage-showcase-minimal", demoIndex: 0, label: "Minimal" },
  { id: "homepage-showcase-dark", demoIndex: 1, label: "Dark" },
  { id: "homepage-showcase-salepop", demoIndex: 2, label: "Sale Pop" },
] as const;

export type HomepageSlotId = (typeof HOMEPAGE_SLOTS)[number]["id"];

export function isHomepageSlotId(id: unknown): id is HomepageSlotId {
  return typeof id === "string" && HOMEPAGE_SLOTS.some((s) => s.id === id);
}

/** Default content for a slot: the demo template, re-keyed to the slot id. */
export function defaultSlotTemplate(slotId: HomepageSlotId): Template {
  const slot = HOMEPAGE_SLOTS.find((s) => s.id === slotId) ?? HOMEPAGE_SLOTS[0];
  const demo = DEMO_TEMPLATES[slot.demoIndex] ?? DEMO_TEMPLATES[0];
  return { ...demo, id: slotId };
}

/** True when a stored record differs from its slot default (design + copy). */
export function isCustomized(stored: Template, slotId: HomepageSlotId): boolean {
  const def = defaultSlotTemplate(slotId);
  const pick = (t: Template) => ({
    name: t.name,
    background: t.background,
    width: t.width,
    height: t.height,
    layers: t.layers,
  });
  return JSON.stringify(pick(stored)) !== JSON.stringify(pick(def));
}
