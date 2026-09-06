// Pure placement-variant helpers for story c-reliable-placement-exports.
//
// Builds the four adapted save candidates from the active draft, fingerprints
// saved placement snapshots for stale detection, and summarizes legacy
// standalone save-all results. No React, no DOM, no network: safe for the
// server, the browser, and unit tests.

import type { SizePreset, Template } from "./types";
import { adaptTemplateToSize } from "./autoLayout";
import type { SizePresetId } from "@/lib/catalogProject";

/** Design-content fingerprint for one placement snapshot. */
export function placementFingerprint(template: Pick<Template, "background" | "height" | "layers" | "name" | "sizeId" | "width">): string {
  return JSON.stringify({
    background: template.background,
    height: template.height,
    layers: template.layers,
    name: template.name,
    sizeId: template.sizeId,
    width: template.width,
  });
}

/**
 * What the editor sends for one placement. Identity and revisions are always
 * assigned by the API from the stored record, so save candidates carry design
 * content only; the master size may additionally carry its live draft fields.
 */
export type PlacementVariantInput = Omit<Template, "id" | "revision" | "createdAt" | "updatedAt"> &
  Partial<Pick<Template, "id" | "revision" | "createdAt" | "updatedAt">>;

/**
 * Adapt the active draft into one save candidate per output size. The master
 * size keeps the live draft object; every other size is an adapted copy
 * without a server identity (the API owns ID/revision assignment).
 */
export function buildPlacementVariants(active: Template, presets: SizePreset[]): { sizeId: SizePresetId; variant: PlacementVariantInput }[] {
  return presets.map((preset) => {
    const sizeId = preset.id as SizePresetId;
    if (preset.id === active.sizeId) return { sizeId, variant: active };
    const { id: _id, revision: _revision, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } =
      adaptTemplateToSize(active, preset);
    void _id;
    void _revision;
    void _createdAt;
    void _updatedAt;
    return { sizeId, variant: { ...rest, name: `${active.name} — ${preset.id}` } };
  });
}

/**
 * True when a placement's current draft still matches its saved snapshot.
 * Pass the open per-size draft when one exists; otherwise the candidate is
 * adapted from the master draft.
 */
export function isPlacementSaved(
  active: Template,
  presets: SizePreset[],
  sizeId: SizePresetId,
  fingerprint: string | undefined,
  draft?: Pick<Template, "background" | "height" | "layers" | "name" | "sizeId" | "width">,
): boolean {
  if (!fingerprint) return false;
  if (draft) return placementFingerprint(draft) === fingerprint;
  const candidate = buildPlacementVariants(active, presets).find((entry) => entry.sizeId === sizeId);
  if (!candidate) return false;
  return placementFingerprint(candidate.variant) === fingerprint;
}

/** Template-list ID for an independently editable per-size draft. */
export function variantDraftId(sizeId: SizePresetId): string {
  return `variant:${sizeId}`;
}

/** Parse a template-list ID back into its placement, or null for master drafts. */
export function parseVariantDraftId(id: string): SizePresetId | null {
  const sizeId = id.startsWith("variant:") ? id.slice("variant:".length) : null;
  return sizeId === "1:1" || sizeId === "4:5" || sizeId === "9:16" || sizeId === "1.91:1" ? sizeId : null;
}

/**
 * What a placement card shows and what save-all persists for that size.
 * Lineage: open draft first, then the live master for the master size,
 * then the last saved snapshot, then a fresh master adaptation. Snapshot
 * before adaptation is what keeps a reloaded customization fresh instead of
 * rendering white-master content against its own saved record.
 */
export function placementView(
  master: Template,
  presets: SizePreset[],
  sizeId: SizePresetId,
  entry?: Template,
  snapshot?: Template,
): Template {
  if (entry) return entry;
  if (sizeId === master.sizeId) return master;
  if (snapshot) return snapshot;
  const preset = presets.find((candidate) => candidate.id === sizeId) ?? presets[0];
  return adaptTemplateToSize(master, preset);
}

/**
 * Promote one placement into the master document without losing a saved or
 * open customization. The master keeps its durable identity while adopting
 * the selected placement's design and dimensions.
 */
export function promotePlacementToMaster(
  master: Template,
  presets: SizePreset[],
  sizeId: SizePresetId,
  entry?: Template,
  snapshot?: Template,
): Template {
  const source = placementView(master, presets, sizeId, entry, snapshot);
  return {
    ...source,
    id: master.id,
    name: master.name,
    createdAt: master.createdAt,
    revision: master.revision,
    updatedAt: Date.now(),
  };
}

export type VariantSaveResult = { sizeId: SizePresetId; ok: true } | { sizeId: SizePresetId; ok: false; error: string };

/** Exact per-placement outcome for legacy standalone save-all reporting. */
export function summarizeVariantSaves(results: VariantSaveResult[]): { succeeded: SizePresetId[]; failed: { sizeId: SizePresetId; error: string }[] } {
  const succeeded: SizePresetId[] = [];
  const failed: { sizeId: SizePresetId; error: string }[] = [];
  for (const result of results) {
    if (result.ok) succeeded.push(result.sizeId);
    else failed.push({ sizeId: result.sizeId, error: result.error });
  }
  return { succeeded, failed };
}
