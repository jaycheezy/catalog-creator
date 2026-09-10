import { describe, expect, it } from "vitest";
import { hasUnsavedPublicationDesign } from "@/editor/publicationState";
import { placementFingerprint, variantDraftId } from "@/editor/placementState";
import { templateFingerprint, type SavedTemplateRecord } from "@/editor/saveState";
import { template } from "./fixtures/catalog";

function masterRecord(): Record<string, SavedTemplateRecord> {
  return {
    [template.id]: {
      templateId: template.id,
      fingerprint: templateFingerprint(template),
      revision: template.revision ?? 0,
    },
  };
}

describe("publication editor state", () => {
  it("allows a fully saved master and placement draft", () => {
    const portrait = { ...template, id: variantDraftId("4:5"), sizeId: "4:5", width: 1080, height: 1350 };
    expect(hasUnsavedPublicationDesign(template, [template, portrait], masterRecord(), {
      "4:5": { templateId: "tpl_portrait", fingerprint: placementFingerprint(portrait), revision: 2 },
    })).toBe(false);
  });

  it("blocks publication for dirty master or inactive placement drafts", () => {
    expect(hasUnsavedPublicationDesign(
      { ...template, background: "#000000" },
      [{ ...template, background: "#000000" }],
      masterRecord(),
      {},
    )).toBe(true);

    const portrait = { ...template, id: variantDraftId("4:5"), sizeId: "4:5", width: 1080, height: 1350 };
    expect(hasUnsavedPublicationDesign(template, [template, portrait], masterRecord(), {
      "4:5": { templateId: "tpl_portrait", fingerprint: "older-design", revision: 1 },
    })).toBe(true);
  });
});
