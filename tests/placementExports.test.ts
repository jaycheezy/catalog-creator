import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CatalogProject } from "@/lib/catalogProject";
import {
  isSizePresetId,
  resolveProjectTemplate,
  savedPlacementTemplate,
} from "@/lib/catalogProject";
import { SIZE_PRESETS, type Template } from "@/editor/types";
import {
  buildPlacementVariants,
  isPlacementSaved,
  parseVariantDraftId,
  placementFingerprint,
  placementView,
  promotePlacementToMaster,
  summarizeVariantSaves,
  variantDraftId,
} from "@/editor/placementState";
import { template } from "./fixtures/catalog";
import { DurableStorageError } from "@/lib/durableStorage";

function projectTemplate(sizeId: string, width: number, height: number, name = "Placement"): Template {
  return {
    ...template,
    id: `tpl_${sizeId.replace(/[:.]/g, "")}`,
    name,
    sizeId,
    width,
    height,
  };
}

function savedProject(): CatalogProject {
  return {
    id: "prj_1234567890abcdef",
    name: "Fixture",
    source: { type: "csv", value: "catalog.csv", format: "csv" },
    products: [{ id: "1", source_id: "csv:row:1", title: "Tea", description: "Tea", availability: "in stock", condition: "new", price: "10.00 EUR", link: "", image_link: "", brand: "Fixture", additional_image_link: "", item_group_id: "", google_product_category: "", sale_price: "", inventory: "" }],
    template: { ...template, revision: 2 },
    placement: "carousel",
    importStatus: { complete: true, totalProducts: 1, totalRows: 1 },
    createdAt: 1,
    updatedAt: 2,
    revision: 3,
  };
}

describe("placement contract helpers", () => {
  it("accepts only the four durable output keys", () => {
    expect(["1:1", "4:5", "9:16", "1.91:1"].every(isSizePresetId)).toBe(true);
    expect(isSizePresetId("16:9")).toBe(false);
    expect(isSizePresetId("carousel")).toBe(false);
    expect(isSizePresetId(undefined)).toBe(false);
  });

  it("migrates old projects by treating the active template as its only saved placement", () => {
    const project = savedProject();
    expect(savedPlacementTemplate(project, "1:1")).toBe(project.template);
    expect(savedPlacementTemplate(project, "9:16")).toBeUndefined();
    const withPlacements: CatalogProject = {
      ...project,
      placementTemplates: { "9:16": projectTemplate("9:16", 1080, 1920) },
    };
    expect(savedPlacementTemplate(withPlacements, "9:16")).toMatchObject({ sizeId: "9:16", width: 1080, height: 1920 });
    expect(savedPlacementTemplate(withPlacements, "1:1")).toBe(project.template);
  });

  it("resolves the active and saved placement templates but never an unknown ID", () => {
    const story = projectTemplate("9:16", 1080, 1920);
    const project: CatalogProject = { ...savedProject(), placementTemplates: { "9:16": story } };
    expect(resolveProjectTemplate(project, null)).toBe(project.template);
    expect(resolveProjectTemplate(project, project.template.id)).toBe(project.template);
    expect(resolveProjectTemplate(project, story.id)).toBe(story);
    expect(resolveProjectTemplate(project, "tpl_nope_nope_nope")).toBeNull();
  });

  it("fingerprints design content rather than server-managed fields", () => {
    const base = projectTemplate("1:1", 1080, 1080);
    const reassigned: Template = { ...base, id: "tpl_other", revision: 9, createdAt: 5, updatedAt: 6 };
    expect(placementFingerprint(reassigned)).toBe(placementFingerprint(base));
    expect(placementFingerprint({ ...base, background: "#000000" })).not.toBe(placementFingerprint(base));
  });

  it("adapts one variant per size while the master keeps its live identity", () => {
    const variants = buildPlacementVariants(template, SIZE_PRESETS);
    expect(variants.map((candidate) => candidate.sizeId)).toEqual(["1:1", "4:5", "9:16", "1.91:1"]);
    expect(variants[0].variant).toBe(template);
    expect(variants[2].variant).toMatchObject({ sizeId: "9:16", width: 1080, height: 1920 });
    expect(variants[2].variant.id).toBeUndefined();
    expect(variants[3].variant).toMatchObject({ sizeId: "1.91:1", width: 1200, height: 628 });
  });

  it("marks only unchanged placements saved after master edits and size switches", () => {
    const placements = buildPlacementVariants(template, SIZE_PRESETS);
    const fingerprints = new Map(placements.map(({ sizeId, variant }) => [sizeId, placementFingerprint(variant)] as const));
    for (const { sizeId } of placements) {
      expect(isPlacementSaved(template, SIZE_PRESETS, sizeId, fingerprints.get(sizeId))).toBe(true);
    }
    const edited = { ...template, layers: [...template.layers, { ...template.layers[0], id: "layer_new" }] };
    expect(isPlacementSaved(edited, SIZE_PRESETS, "1:1", fingerprints.get("1:1"))).toBe(false);
    expect(isPlacementSaved(edited, SIZE_PRESETS, "9:16", fingerprints.get("9:16"))).toBe(false);
    expect(isPlacementSaved(edited, SIZE_PRESETS, "1:1", undefined)).toBe(false);
  });

  it("reports exact per-placement outcomes for legacy standalone saves", () => {
    expect(summarizeVariantSaves([
      { sizeId: "1:1", ok: true },
      { sizeId: "4:5", ok: false, error: "boom" },
    ])).toEqual({ succeeded: ["1:1"], failed: [{ sizeId: "4:5", error: "boom" }] });
  });

  it("addresses independent per-size drafts without colliding with master IDs", () => {
    expect(variantDraftId("9:16")).toBe("variant:9:16");
    expect(parseVariantDraftId("variant:9:16")).toBe("9:16");
    expect(parseVariantDraftId(template.id)).toBeNull();
    expect(parseVariantDraftId("variant:16:9")).toBeNull();
  });

  it("keeps saved snapshots fresh after a reload with no edits", () => {
    // Simulate save-all: records fingerprinted from the sent candidates.
    const candidates = buildPlacementVariants(template, SIZE_PRESETS);
    const records = new Map(candidates.map(({ sizeId, variant }) => [sizeId, placementFingerprint(variant)] as const));
    // Simulate reopening: a fresh master object with identical content.
    const reloaded = structuredClone(template);
    for (const { sizeId } of candidates) {
      expect(isPlacementSaved(reloaded, SIZE_PRESETS, sizeId, records.get(sizeId))).toBe(true);
    }
  });

  it("checks an open variant draft instead of the master adaptation", () => {
    const placements = buildPlacementVariants(template, SIZE_PRESETS);
    const story = placements.find((candidate) => candidate.sizeId === "9:16")!.variant;
    const fingerprint = placementFingerprint(story);
    // The open draft matches its own snapshot even after the master changes.
    const changedMaster = { ...template, background: "#000000" };
    expect(isPlacementSaved(changedMaster, SIZE_PRESETS, "9:16", fingerprint, story)).toBe(true);
    expect(isPlacementSaved(changedMaster, SIZE_PRESETS, "9:16", fingerprint)).toBe(false);
    expect(isPlacementSaved(changedMaster, SIZE_PRESETS, "9:16", fingerprint, { ...story, background: "#000000" })).toBe(false);
  });

  it("renders the saved snapshot as the reopened baseline, not a fresh adaptation", () => {
    // A genuinely customized 9:16 snapshot (e.g. its own background).
    const snapshot = { ...template, name: "Custom story", sizeId: "9:16", width: 1080, height: 1920, background: "#ffeecc" };
    const record = placementFingerprint(snapshot);
    // After reload there is no open draft: the card shows the snapshot, fresh.
    const view = placementView(template, SIZE_PRESETS, "9:16", undefined, snapshot);
    expect(view).toBe(snapshot);
    expect(placementFingerprint(view)).toBe(record);
    // The master size always shows the live master, never a stale snapshot.
    const masterSnapshot = { ...template, background: "#eeeeee" };
    expect(placementView({ ...template, background: "#ffffff" }, SIZE_PRESETS, "1:1", undefined, masterSnapshot)).toMatchObject({
      background: "#ffffff",
    });
    // Open drafts win, including when their size is later promoted to master.
    const entry = { ...snapshot, layers: [] };
    expect(placementView(template, SIZE_PRESETS, "9:16", entry, snapshot)).toBe(entry);
    const promotedMaster = { ...template, sizeId: "9:16", width: 1080, height: 1920, background: "#ffffff" };
    expect(placementView(promotedMaster, SIZE_PRESETS, "9:16", entry, snapshot)).toBe(entry);
    // Untouched sizes adapt from the master.
    expect(placementView(template, SIZE_PRESETS, "4:5", undefined, undefined)).toMatchObject({
      sizeId: "4:5", width: 1080, height: 1350,
    });
  });

  it("promotes a customized placement into the master without losing its design", () => {
    const snapshot = { ...template, id: "tpl_portrait", name: "Old placement name", sizeId: "4:5", width: 1080, height: 1350, background: "#ffeecc" };
    const draft = { ...snapshot, id: variantDraftId("4:5"), layers: [] };
    const promoted = promotePlacementToMaster(template, SIZE_PRESETS, "4:5", draft, snapshot);
    expect(promoted).toMatchObject({
      id: template.id,
      name: template.name,
      sizeId: "4:5",
      width: 1080,
      height: 1350,
      background: "#ffeecc",
      layers: [],
      createdAt: template.createdAt,
      revision: template.revision,
    });
  });
});

let stored: CatalogProject | null = null;
let storeError: Error | null = null;
let mirrorError: Error | null = null;

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, isAuthenticated: vi.fn(async () => true) };
});
vi.mock("@/lib/templateStore", () => ({
  saveTemplate: vi.fn(async () => {
    if (mirrorError) throw mirrorError;
  }),
}));
vi.mock("@/lib/catalogProjectStore", () => ({
  saveCatalogProject: vi.fn(async (project: CatalogProject) => {
    if (storeError) throw storeError;
    stored = structuredClone(project);
  }),
  getCatalogProject: vi.fn(async () => stored),
}));

import { PATCH } from "@/app/api/projects/route";
import { saveCatalogProject } from "@/lib/catalogProjectStore";
import { saveTemplate } from "@/lib/templateStore";

beforeEach(() => {
  stored = savedProject();
  storeError = null;
  mirrorError = null;
  vi.clearAllMocks();
});

const patchRequest = (body: unknown) =>
  new NextRequest("https://catalog.example/api/projects", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

function placementInputs() {
  return Object.fromEntries(
    buildPlacementVariants(template, SIZE_PRESETS).map(({ sizeId, variant }) => [sizeId, variant]),
  );
}

describe("project placement-template API", () => {
  it("persists all four placements atomically and returns their IDs and revisions", async () => {
    const response = await PATCH(patchRequest({ id: stored!.id, placementTemplates: placementInputs(), expectedRevision: 3 }));
    expect(response.status).toBe(200);
    const json = await response.json() as {
      revision: number;
      variants: { sizeId: string; templateId: string; templateRevision: number; width: number; height: number }[];
    };
    expect(json.revision).toBe(4);
    expect(json.variants).toHaveLength(4);
    expect(json.variants.find((variant) => variant.sizeId === "9:16")).toMatchObject({
      templateRevision: 1, width: 1080, height: 1920,
    });
    expect(json.variants.find((variant) => variant.sizeId === "1.91:1")).toMatchObject({ width: 1200, height: 628 });
    // The saved catalog is untouched; the active template keeps its identity.
    expect(stored!.products).toHaveLength(1);
    expect(stored!.template.id).toBe(template.id);
    expect(stored!.placementTemplates?.["1:1"]?.sizeId).toBe("1:1");

    // A second save-all preserves placement identities and bumps revisions.
    const firstIds = new Map(json.variants.map((variant) => [variant.sizeId, variant.templateId]));
    const second = await PATCH(patchRequest({ id: stored!.id, placementTemplates: placementInputs(), expectedRevision: 4 }));
    const secondJson = await second.json() as typeof json;
    expect(secondJson.revision).toBe(5);
    for (const variant of secondJson.variants) {
      expect(variant.templateId).toBe(firstIds.get(variant.sizeId));
      expect(variant.templateRevision).toBe(2);
    }
  });

  it("merges a single-variant save without touching other placements", async () => {
    const full = await PATCH(patchRequest({ id: stored!.id, placementTemplates: placementInputs(), expectedRevision: 3 }));
    expect(full.status).toBe(200);
    const storyBefore = stored!.placementTemplates?.["9:16"];
    const revised = { ...template, name: "Square refresh", sizeId: "1:1", width: 1080, height: 1080 };
    const single = await PATCH(patchRequest({
      id: stored!.id,
      placementTemplates: { "1:1": revised },
      expectedRevision: 4,
    }));
    expect(single.status).toBe(200);
    const json = await single.json() as { revision: number; variants: { sizeId: string; templateRevision: number }[] };
    expect(json.revision).toBe(5);
    expect(stored!.placementTemplates?.["1:1"]).toMatchObject({ name: "Square refresh", revision: 2 });
    // Untouched placements keep their identity and revision.
    expect(stored!.placementTemplates?.["9:16"]).toMatchObject({ id: storyBefore?.id, revision: 1 });
    expect(json.variants).toHaveLength(4);
  });

  it("rejects stale revisions without writing", async () => {
    const response = await PATCH(patchRequest({ id: stored!.id, placementTemplates: placementInputs(), expectedRevision: 2 }));
    expect(response.status).toBe(409);
    expect(saveCatalogProject).not.toHaveBeenCalled();
    expect(stored!.placementTemplates).toBeUndefined();
  });

  it("saves none when a placement key, size, dimensions, or layers are invalid", async () => {
    const inputs = placementInputs() as Record<string, Template>;
    const withoutLayers = { ...inputs["1:1"], layers: undefined as unknown as Template["layers"] };
    for (const bad of [
      { ...inputs, "16:9": inputs["1:1"] },
      { ...inputs, "9:16": { ...inputs["9:16"], sizeId: "1:1" } },
      { ...inputs, "4:5": { ...inputs["4:5"], width: 100, height: 100 } },
      { ...inputs, "1:1": withoutLayers },
    ]) {
      const response = await PATCH(patchRequest({ id: stored!.id, placementTemplates: bad, expectedRevision: 3 }));
      expect(response.status).toBe(400);
    }
    // Every invalid save-all must fail before any write.
    expect(saveCatalogProject).not.toHaveBeenCalled();
    expect(stored!.placementTemplates).toBeUndefined();
    expect(stored!.revision).toBe(3);
  });

  it("keeps every draft and prior saved record when durable storage fails", async () => {
    storeError = new DurableStorageError("R2 write failed");
    const response = await PATCH(patchRequest({ id: stored!.id, placementTemplates: placementInputs(), expectedRevision: 3 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DURABLE_STORAGE_FAILED", retryable: true });
    expect(stored!.placementTemplates).toBeUndefined();
    expect(stored!.revision).toBe(3);
  });

  it("leaves no partial state behind when the combined template and placement save fails", async () => {
    storeError = new DurableStorageError("R2 write failed");
    const response = await PATCH(patchRequest({
      id: stored!.id,
      expectedRevision: 3,
      template: { ...savedProject().template, name: "Unsaved draft" },
      placementTemplates: placementInputs(),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DURABLE_STORAGE_FAILED", retryable: true });
    // The authoritative aggregate never advanced, and because it is written
    // first, the standalone template mirror never ran either.
    expect(stored!.template.name).toBe(savedProject().template.name);
    expect(stored!.template.revision).toBe(2);
    expect(stored!.placementTemplates).toBeUndefined();
    expect(stored!.revision).toBe(3);
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it("keeps an authoritative project save successful when its legacy template mirror fails", async () => {
    mirrorError = new DurableStorageError("Legacy mirror unavailable");
    const response = await PATCH(patchRequest({
      id: stored!.id,
      expectedRevision: 3,
      template: { ...savedProject().template, name: "Confirmed project design" },
      placementTemplates: placementInputs(),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, revision: 4 });
    expect(stored!.template).toMatchObject({ name: "Confirmed project design", revision: 3 });
    expect(stored!.placementTemplates?.["9:16"]).toMatchObject({ width: 1080, height: 1920 });
    expect(saveTemplate).toHaveBeenCalledOnce();
  });
});
