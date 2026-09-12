import { describe, expect, it } from "vitest";
import { isTemplateSaved, templateFingerprint, type SavedTemplateRecord } from "@/editor/saveState";
import { template } from "./fixtures/catalog";

describe("editor durable save state", () => {
  const recordFor = (name = template.name): SavedTemplateRecord => ({
    templateId: template.id,
    fingerprint: templateFingerprint({ ...template, name, revision: 3 }),
    revision: 3,
  });

  it("ignores server-managed revision fields when matching a saved design", () => {
    expect(isTemplateSaved({ ...template, revision: 9, updatedAt: 999 }, recordFor())).toBe(true);
  });

  it("invalidates saved state and its export eligibility after an edit", () => {
    const record = recordFor();
    expect(isTemplateSaved(template, record)).toBe(true);
    expect(isTemplateSaved({ ...template, name: "Unsaved edit" }, record)).toBe(false);
  });

  it("does not carry one template's saved state to a switched template", () => {
    const switched = { ...template, id: "tpl_abcdef1234567890", name: "Second template" };
    expect(isTemplateSaved(switched, recordFor())).toBe(false);
  });

  it("keeps a newer draft unsaved when an older in-flight save completes", () => {
    const submitted = { ...template, background: "#111827", updatedAt: 10 };
    const newerDraft = {
      ...submitted,
      background: "#2563eb",
      updatedAt: 11,
      revision: 4,
    };
    const completedSave: SavedTemplateRecord = {
      templateId: submitted.id,
      fingerprint: templateFingerprint({ ...submitted, revision: 4 }),
      revision: 4,
    };
    expect(isTemplateSaved(newerDraft, completedSave)).toBe(false);
  });
});
