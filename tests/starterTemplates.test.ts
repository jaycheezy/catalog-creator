import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "@/editor/starterTemplates";
import { SIZE_PRESETS } from "@/editor/types";

const PRESET_IDS = ["1:1", "4:5", "9:16", "1.91:1"];
const ALLOWED_BINDINGS = new Set(["title", "price", "discount_pct", "vendor"]);
const ALLOWED_TYPES = new Set(["product-image", "text", "badge", "shape"]);
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function bindingsIn(content: string | undefined): string[] {
  if (!content) return [];
  const out: string[] = [];
  for (const m of content.matchAll(/{{(.*?)}}/g)) out.push(m[1].trim());
  return out;
}

describe("starter templates", () => {
  it("exports exactly the five starters with names and one-line blurbs", () => {
    expect(STARTER_TEMPLATES.map((s) => s.id)).toEqual([
      "product-highlight",
      "special-offer",
      "new-arrival",
      "seasonal",
      "discount",
    ]);
    expect(STARTER_TEMPLATES.map((s) => s.name)).toEqual([
      "Product Highlight",
      "Special Offer",
      "New Arrival",
      "Seasonal",
      "Discount",
    ]);
    for (const s of STARTER_TEMPLATES) {
      expect(typeof s.blurb).toBe("string");
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.blurb).not.toContain("\n");
      expect(typeof s.build).toBe("function");
    }
  });

  it("covers all four size presets", () => {
    expect(PRESET_IDS).toEqual(SIZE_PRESETS.map((p) => p.id));
  });

  for (const starter of STARTER_TEMPLATES) {
    for (const sizeId of PRESET_IDS) {
      it(`${starter.id} × ${sizeId}: dims, bounds, ids, bindings, background`, () => {
        const preset = SIZE_PRESETS.find((p) => p.id === sizeId)!;
        const tpl = starter.build(sizeId);

        expect(tpl.sizeId).toBe(preset.id);
        expect(tpl.width).toBe(preset.width);
        expect(tpl.height).toBe(preset.height);
        expect(tpl.layers.length).toBeGreaterThanOrEqual(3);
        expect(HEX_RE.test(tpl.background)).toBe(true);

        const ids = new Set<string>();
        tpl.layers.forEach((layer, i) => {
          expect(ALLOWED_TYPES.has(layer.type)).toBe(true);
          expect(layer.z).toBe(i + 1);
          expect(layer.visible).toBe(true);
          expect(layer.locked).toBe(false);
          expect(Number.isFinite(layer.rotation)).toBe(true);
          for (const n of [layer.x, layer.y, layer.w, layer.h]) {
            expect(Number.isFinite(n)).toBe(true);
          }
          expect(layer.w).toBeGreaterThanOrEqual(40);
          expect(layer.h).toBeGreaterThanOrEqual(40);
          expect(layer.x).toBeGreaterThanOrEqual(0);
          expect(layer.y).toBeGreaterThanOrEqual(0);
          expect(layer.x + layer.w).toBeLessThanOrEqual(tpl.width);
          expect(layer.y + layer.h).toBeLessThanOrEqual(tpl.height);
          expect(layer.id.startsWith("layer_")).toBe(true);
          expect(ids.has(layer.id)).toBe(false);
          ids.add(layer.id);
          for (const b of bindingsIn(layer.content)) {
            expect(ALLOWED_BINDINGS.has(b)).toBe(true);
          }
        });

        // No {{...}} bindings outside the allowlist anywhere in the template.
        const raw = JSON.stringify(tpl);
        for (const m of raw.matchAll(/{{(.*?)}}/g)) {
          expect(ALLOWED_BINDINGS.has(m[1].trim())).toBe(true);
        }

        // Fresh builds mint fresh unique ids.
        const again = starter.build(sizeId);
        const againIds = new Set(again.layers.map((l) => l.id));
        expect(againIds.size).toBe(again.layers.length);
        for (const id of ids) expect(againIds.has(id)).toBe(false);
      });
    }
  }
});
