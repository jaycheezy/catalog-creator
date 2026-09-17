import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_SLOTS,
  defaultSlotTemplate,
  isCustomized,
  isHomepageSlotId,
} from "@/lib/homepageTemplates";
import { DEMO_TEMPLATES } from "@/lib/demoTemplates";

describe("homepage showcase slots", () => {
  it("registers three slots with long, valid ids", () => {
    expect(HOMEPAGE_SLOTS).toHaveLength(3);
    for (const slot of HOMEPAGE_SLOTS) {
      expect(slot.id).toMatch(/^[A-Za-z0-9_-]{12,64}$/);
      expect(isHomepageSlotId(slot.id)).toBe(true);
    }
    expect(isHomepageSlotId("demo-minimal")).toBe(false);
    expect(isHomepageSlotId("tpl_random")).toBe(false);
    expect(isHomepageSlotId(undefined)).toBe(false);
  });

  it("defaults mirror the demo templates under slot ids", () => {
    for (const slot of HOMEPAGE_SLOTS) {
      const def = defaultSlotTemplate(slot.id);
      const demo = DEMO_TEMPLATES[slot.demoIndex];
      expect(def.id).toBe(slot.id);
      expect(def.layers).toEqual(demo.layers);
      expect(def.width).toBe(demo.width);
    }
  });

  it("detects customization", () => {
    const slot = HOMEPAGE_SLOTS[0].id;
    const def = defaultSlotTemplate(slot);
    expect(isCustomized(def, slot)).toBe(false);
    expect(isCustomized({ ...def, name: "Renamed" }, slot)).toBe(true);
    expect(
      isCustomized({ ...def, layers: [...def.layers, { ...def.layers[0], id: "extra" }] }, slot)
    ).toBe(true);
  });
});
