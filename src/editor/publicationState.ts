import type { Template } from "./types";
import { parseVariantDraftId, placementFingerprint } from "./placementState";
import { isTemplateSaved, type SavedTemplateRecord } from "./saveState";
import type { SizePresetId } from "@/lib/catalogProject";

/**
 * Publication freezes the durable project, so every visible editor draft must
 * be saved before the action can truthfully claim to publish reviewed work.
 */
export function hasUnsavedPublicationDesign(
  master: Template,
  templates: Template[],
  savedTemplates: Record<string, SavedTemplateRecord>,
  savedPlacements: Partial<Record<SizePresetId, SavedTemplateRecord>>,
): boolean {
  if (!isTemplateSaved(master, savedTemplates[master.id])) return true;
  return templates.some((candidate) => {
    const sizeId = parseVariantDraftId(candidate.id);
    if (!sizeId) return false;
    const saved = savedPlacements[sizeId];
    return !saved || placementFingerprint(candidate) !== saved.fingerprint;
  });
}
