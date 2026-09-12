import { describe, expect, it } from "vitest";
import { createAgentWorkspaceTools } from "@/agent/tools";
import type { FeedRow } from "@/lib/facebook";
import { validateCatalog } from "@/lib/catalogValidation";
import type { Layer, Template } from "@/editor/types";
import {
  WorkspaceDesignHistory,
  applyDesignEdits,
  parseDesignBatchInput,
} from "@/workspace/designCommands";
import {
  workspaceCapabilities,
  type WorkspaceApplyDesignResult,
  type WorkspaceAgentActivity,
  type WorkspaceContextSnapshot,
  type WorkspaceDesignEdit,
  type WorkspaceDesignSnapshot,
  type WorkspaceDraftTargetId,
  type WorkspaceViewChange,
} from "@/workspace/contracts";

const SESSION_ID = "workspace_design_fixture";
const PROJECT_ID = "prj_design_fixture";

function layer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: "layer_title",
    type: "text",
    name: "Title",
    x: 80,
    y: 860,
    w: 920,
    h: 80,
    rotation: 0,
    z: 2,
    visible: true,
    locked: false,
    style: { color: "#111111", fontSize: 42, fontWeight: 700 },
    content: "{{title}}",
    ...overrides,
  };
}

function template(): Template {
  return {
    id: "tpl_design_fixture",
    name: "Design fixture",
    sizeId: "1:1",
    width: 1080,
    height: 1080,
    background: "#ffffff",
    layers: [
      layer(),
      layer({ id: "layer_locked", name: "Locked", locked: true, y: 80 }),
    ],
    createdAt: 1,
    updatedAt: 2,
    revision: 3,
  };
}

function product(index: number): FeedRow {
  return {
    id: `SKU-${index}`,
    source_id: `shopify:variant:${index}`,
    title: `Product ${index}`,
    description: "A complete fixture product description.",
    availability: "in stock",
    condition: "new",
    price: "19.99 EUR",
    link: `https://shop.example/products/${index}`,
    image_link: `https://cdn.example/${index}.jpg`,
    brand: "Fixture",
  };
}

function context(): WorkspaceContextSnapshot {
  return {
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    draftRevision: 0,
    viewRevision: 0,
    data: {
      busy: { loading: false, saving: false, publishing: false },
      project: {
        name: "Design fixture",
        source: { type: "csv", format: "csv", currencyCodes: ["EUR"] },
        productCount: 2,
        totalProducts: 2,
        totalRows: 2,
        importComplete: true,
        validation: { status: "needs-review", errors: 0, warnings: 1, imageChecks: "not-run" },
      },
      design: {
        activeTargetId: "master",
        activeSizeId: "1:1",
        masterSizeId: "1:1",
        activeSaved: true,
        dirty: false,
        savedProjectRevision: 4,
        savedTemplateRevision: 3,
        placements: [{ sizeId: "1:1", targetId: "master", active: true, open: true, saved: true, savedRevision: 3 }],
      },
      view: { mode: "canvas", selectedProductId: "shopify:variant:1", selectedLayerId: "layer_title" },
      publication: { status: "not-published", publishedProjectRevision: null, draftNewer: false },
      agent: { mutationsAvailable: true, paused: false, activityCount: 0, canUndo: false },
      capabilities: workspaceCapabilities([]),
    },
  };
}

function identity() {
  return { sessionId: SESSION_ID, projectId: PROJECT_ID };
}

function designToolHarness(verifySession?: () => boolean | Promise<boolean>) {
  const products = [product(1), product(2)];
  let current = context();
  let design: WorkspaceDesignSnapshot = { targetId: "master", template: template() };
  let paused = false;
  let commits = 0;
  const activities: WorkspaceAgentActivity[] = [];
  const history = new WorkspaceDesignHistory();
  const tools = createAgentWorkspaceTools(() => current, {
    verifySession,
    readCatalog: () => ({ projectId: PROJECT_ID, revision: 4, products, validation: validateCatalog(products) }),
    readDesign: () => design,
    commitView: () => current,
    commitDesign: (change) => {
      commits += 1;
      design = { targetId: change.targetId, template: change.template };
      current = {
        ...current,
        draftRevision: current.draftRevision + 1,
        viewRevision: current.viewRevision + (change.clearSelectedLayer ? 1 : 0),
        data: {
          ...current.data,
          design: { ...current.data.design, activeSaved: false, dirty: true },
          view: { ...current.data.view, ...(change.clearSelectedLayer ? { selectedLayerId: null } : {}) },
        },
      };
      return current;
    },
    designHistory: history,
    isPaused: () => paused,
    recordActivity: (activity) => activities.push(activity),
    markActivityUndone: (token, undoDraftRevision) => {
      const activity = activities.find((entry) => entry.transactionToken === token);
      if (activity) {
        activity.status = "undone";
        activity.undoDraftRevision = undoDraftRevision;
      }
    },
  });
  return {
    tools,
    history,
    activities,
    get current() { return current; },
    get design() { return design; },
    get commits() { return commits; },
    setPaused(value: boolean) { paused = value; },
    humanEdit(nextTemplate: Template, targetId: WorkspaceDraftTargetId = design.targetId) {
      design = { targetId, template: nextTemplate };
      current = { ...current, draftRevision: current.draftRevision + 1 };
    },
    switchProject(projectId: string) {
      current = { ...current, projectId };
    },
    completeSave(revision: number) {
      design = { ...design, template: { ...design.template, revision, updatedAt: design.template.updatedAt + 1 } };
      current = {
        ...current,
        data: { ...current.data, design: { ...current.data.design, activeSaved: true, savedTemplateRevision: revision } },
      };
    },
  };
}

describe("design command validation", () => {
  it("applies a typed batch to a copy and returns a bounded diff", () => {
    const original = template();
    const badge = layer({
      id: "layer_sale",
      type: "badge",
      name: "Sale badge",
      x: 40,
      y: 40,
      w: 240,
      h: 72,
      z: 5,
      style: { background: "#dc2626", color: "#ffffff", fontSize: 28 },
      content: "{{discount_pct}}% OFF",
    });
    const edits: WorkspaceDesignEdit[] = [
      { type: "set-background", background: "#101820" },
      { type: "update-layer", layerId: "layer_title", patch: { y: 820, style: { color: "#ffffff" } } },
      { type: "add-layer", layer: badge },
    ];
    const result = applyDesignEdits(original, edits);
    expect(result).toMatchObject({ ok: true, data: { changedLayerIds: ["layer_sale", "layer_title"] } });
    if (!result.ok) throw new Error("Expected design batch to pass");
    expect(result.data.template).toMatchObject({ background: "#101820" });
    expect(result.data.template.layers.find(({ id }) => id === "layer_title")).toMatchObject({ y: 820, style: { color: "#ffffff" } });
    expect(result.data.diff).toHaveLength(3);
    expect(original).toEqual(template());
  });

  it("rejects a mixed invalid batch without changing its input", () => {
    const original = template();
    const before = structuredClone(original);
    const result = applyDesignEdits(original, [
      { type: "set-background", background: "#111111" },
      { type: "update-layer", layerId: "missing", patch: { x: 40 } },
    ]);
    expect(result).toMatchObject({ ok: false, error: { code: "LAYER_NOT_FOUND" } });
    expect(original).toEqual(before);
  });

  it("rejects locked layers, unsafe CSS, HTML, unsupported bindings, and unknown fields", () => {
    expect(applyDesignEdits(template(), [{ type: "remove-layer", layerId: "layer_locked" }]))
      .toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPERATION" } });

    const base = { ...identity(), targetId: "master", expectedDraftRevision: 0, operationId: "op-safe" };
    expect(parseDesignBatchInput({ ...base, edits: [{ type: "set-background", background: "url(https://evil.example/x)" }] }))
      .toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPERATION" } });
    expect(parseDesignBatchInput({ ...base, edits: [{ type: "update-layer", layerId: "layer_title", patch: { content: "<script>bad</script>" } }] }))
      .toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPERATION" } });
    expect(parseDesignBatchInput({ ...base, edits: [{ type: "update-layer", layerId: "layer_title", patch: { content: "{{system_prompt}}" } }] }))
      .toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPERATION" } });
    expect(parseDesignBatchInput({ ...base, edits: [{ type: "update-layer", layerId: "layer_title", patch: { locked: false } }] }))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseDesignBatchInput({
      ...base,
      edits: [{ type: "add-layer", layer: { id: "second_image", type: "product-image", name: "Image", x: 0, y: 0, w: 100, h: 100 } }],
    })).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseDesignBatchInput({
      ...base,
      edits: Array.from({ length: 21 }, () => ({ type: "set-background", background: "#ffffff" })),
    })).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
  });

  it("keeps a bounded operation receipt and snapshot history", () => {
    const history = new WorkspaceDesignHistory(1);
    const firstResult: WorkspaceApplyDesignResult = {
      operationId: "op-1",
      transactionToken: "txn-1",
      targetId: "master",
      appliedDraftRevision: 1,
      changedLayerIds: [],
      diff: [],
      persisted: false,
    };
    history.record({ signature: "same", result: firstResult, before: template(), after: template(), createdAt: 1 });
    expect(history.lookup("op-1", "same").status).toBe("match");
    expect(history.lookup("op-1", "different").status).toBe("conflict");
    history.record({ signature: "second", result: { ...firstResult, operationId: "op-2" }, before: template(), after: template(), createdAt: 2 });
    expect(history.lookup("op-1", "same").status).toBe("missing");
    expect(history.list()).toHaveLength(1);
  });
});

describe("design WebMCP tools", () => {
  it("records one visible transaction and safely undoes it after a save metadata update", async () => {
    const harness = designToolHarness();
    const applied = await harness.tools[5].execute({
      ...identity(),
      targetId: "master",
      expectedDraftRevision: 0,
      operationId: "op-darken",
      edits: [{ type: "set-background", background: "#101820" }],
    }, {});
    expect(applied).toMatchObject({
      ok: true,
      draftRevision: 1,
      data: { operationId: "op-darken", changedLayerIds: [], persisted: false },
    });
    const token = (applied as { data: WorkspaceApplyDesignResult }).data.transactionToken;
    expect(harness.activities).toMatchObject([{
      actor: "agent",
      operationId: "op-darken",
      transactionToken: token,
      beforeDraftRevision: 0,
      afterDraftRevision: 1,
      status: "applied",
      result: { transactionToken: token },
    }]);

    // Durable save metadata may complete without changing the draft content or
    // revision; it must not make a still-safe undo look stale.
    harness.completeSave(4);
    const undone = await harness.tools[6].execute({
      ...identity(),
      expectedDraftRevision: 1,
      undoToken: token,
    }, {});
    expect(undone).toMatchObject({
      ok: true,
      draftRevision: 2,
      data: { undoneTransactionToken: token, appliedDraftRevision: 2, persisted: false },
    });
    expect(harness.design.template).toMatchObject({ background: "#ffffff", revision: 4 });
    expect(harness.activities[0]).toMatchObject({ status: "undone", undoDraftRevision: 2 });
    expect(harness.history.list()).toHaveLength(0);
  });

  it("rejects undo after an intervening human edit and preserves that edit", async () => {
    const harness = designToolHarness();
    const applied = await harness.tools[5].execute({
      ...identity(), targetId: "master", expectedDraftRevision: 0, operationId: "op-agent-color",
      edits: [{ type: "set-background", background: "#111827" }],
    }, {});
    const token = (applied as { data: WorkspaceApplyDesignResult }).data.transactionToken;
    harness.humanEdit({ ...harness.design.template, background: "#2563eb", updatedAt: 10 });

    await expect(harness.tools[6].execute({
      ...identity(), expectedDraftRevision: 2, undoToken: token,
    }, {})).resolves.toMatchObject({ ok: false, error: { code: "UNDO_CONFLICT" } });
    expect(harness.design.template.background).toBe("#2563eb");
    expect(harness.commits).toBe(1);
  });

  it("rejects an undo token from a project session that is no longer active", async () => {
    const harness = designToolHarness();
    const applied = await harness.tools[5].execute({
      ...identity(), targetId: "master", expectedDraftRevision: 0, operationId: "op-old-project",
      edits: [{ type: "set-background", background: "#111827" }],
    }, {});
    const token = (applied as { data: WorkspaceApplyDesignResult }).data.transactionToken;
    harness.switchProject("prj_another_fixture");

    await expect(harness.tools[6].execute({
      ...identity(), expectedDraftRevision: 1, undoToken: token,
    }, {})).resolves.toMatchObject({ ok: false, error: { code: "SESSION_CHANGED" } });
    expect(harness.design.template.background).toBe("#111827");
    expect(harness.commits).toBe(1);
  });

  it("checks pause after authorization so a queued mutation cannot slip through", async () => {
    let authorize: ((allowed: boolean) => void) | undefined;
    const authorization = new Promise<boolean>((resolve) => { authorize = resolve; });
    const harness = designToolHarness(() => authorization);
    const pending = harness.tools[5].execute({
      ...identity(), targetId: "master", expectedDraftRevision: 0, operationId: "op-queued",
      edits: [{ type: "set-background", background: "#111827" }],
    }, {});
    await Promise.resolve();
    harness.setPaused(true);
    authorize?.(true);

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_OPERATION", message: expect.stringContaining("paused"), retryable: true },
    });
    expect(harness.design.template.background).toBe("#ffffff");
    expect(harness.commits).toBe(0);
    expect(harness.activities).toHaveLength(0);
    await expect(harness.tools[4].execute({
      ...identity(), expectedViewRevision: 0, productId: "shopify:variant:2",
    }, {})).resolves.toMatchObject({ ok: false, error: { message: expect.stringContaining("paused") } });
  });

  it("expires old snapshots at 50 entries and releases history on session teardown", () => {
    const history = new WorkspaceDesignHistory();
    for (let index = 0; index < 51; index += 1) {
      const result: WorkspaceApplyDesignResult = {
        operationId: `op-${index}`,
        transactionToken: `txn_${index}`,
        targetId: "master",
        appliedDraftRevision: index + 1,
        changedLayerIds: [],
        diff: [],
        persisted: false,
      };
      history.record({ signature: `signature-${index}`, result, before: template(), after: template(), createdAt: index });
    }
    expect(history.list()).toHaveLength(50);
    expect(history.lookup("op-0", "signature-0").status).toBe("missing");
    expect(history.lookup("op-50", "signature-50").status).toBe("match");
    history.clear();
    expect(history.list()).toHaveLength(0);
    expect(history.latest()).toBeNull();
  });

  it("reads live design state, changes the view, applies once, and preserves newer edits", async () => {
    const products = [product(1), product(2)];
    let current = context();
    let design: WorkspaceDesignSnapshot = { targetId: "master", template: template() };
    const commitView = (change: WorkspaceViewChange) => {
      current = {
        ...current,
        viewRevision: current.viewRevision + 1,
        data: {
          ...current.data,
          view: {
            mode: change.panel ?? current.data.view.mode,
            selectedProductId: change.productIndex === undefined ? current.data.view.selectedProductId : products[change.productIndex].source_id ?? null,
            selectedLayerId: change.layerId === undefined ? current.data.view.selectedLayerId : change.layerId,
          },
        },
      };
      return current;
    };
    const commitDesign = (change: { targetId: "master" | `placement:${"1:1" | "4:5" | "9:16" | "1.91:1"}`; template: Template; clearSelectedLayer: boolean }) => {
      design = { targetId: change.targetId, template: change.template };
      current = {
        ...current,
        draftRevision: current.draftRevision + 1,
        viewRevision: current.viewRevision + (change.clearSelectedLayer ? 1 : 0),
        data: {
          ...current.data,
          design: { ...current.data.design, activeSaved: false, dirty: true },
          view: { ...current.data.view, ...(change.clearSelectedLayer ? { selectedLayerId: null } : {}) },
        },
      };
      return current;
    };
    const tools = createAgentWorkspaceTools(() => current, {
      readCatalog: () => ({ projectId: PROJECT_ID, revision: 4, products, validation: validateCatalog(products) }),
      readDesign: () => design,
      commitView,
      commitDesign,
    });
    expect(tools.map(({ name }) => name)).toEqual([
      "catalog_forge_get_context",
      "catalog_forge_query_products",
      "catalog_forge_get_validation",
      "catalog_forge_get_design",
      "catalog_forge_set_view",
      "catalog_forge_apply_design_changes",
      "catalog_forge_undo_design_change",
    ]);

    design = { ...design, template: { ...design.template, background: "#fef3c7" } };
    await expect(tools[3].execute(identity(), {})).resolves.toMatchObject({
      ok: true,
      data: {
        targetId: "master",
        template: { background: "#fef3c7", layers: expect.any(Array) },
        state: { activeSaved: true, savedProjectRevision: 4, savedTemplateRevision: 3 },
        supported: { addLayerTypes: ["text", "badge", "shape"] },
        rendering: { surface: "browser-draft", serverOutputUsesSavedRevision: true },
      },
    });

    await expect(tools[4].execute({ ...identity(), expectedViewRevision: 0, productId: "shopify:variant:2", layerId: null, panel: "all-sizes" }, {}))
      .resolves.toMatchObject({ ok: true, viewRevision: 1, data: { selectedProductId: "shopify:variant:2", selectedLayerId: null, panel: "all-sizes" } });
    await expect(tools[4].execute({ ...identity(), expectedViewRevision: 0, productId: "shopify:variant:1" }, {}))
      .resolves.toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    await expect(tools[4].execute({ ...identity(), expectedViewRevision: 1, productId: "shopify:variant:missing" }, {}))
      .resolves.toMatchObject({ ok: false, error: { code: "PRODUCT_NOT_FOUND" } });

    const operation = {
      ...identity(),
      targetId: "master",
      expectedDraftRevision: 0,
      operationId: "op-add-badge",
      edits: [{
        type: "add-layer",
        layer: {
          id: "layer_agent_badge",
          type: "badge",
          name: "Agent badge",
          x: 40,
          y: 40,
          w: 220,
          h: 64,
          content: "{{price}}",
          style: { background: "#111111", color: "#ffffff" },
        },
      }],
    };
    const first = await tools[5].execute(operation, {});
    expect(first).toMatchObject({ ok: true, draftRevision: 1, data: { operationId: "op-add-badge", persisted: false } });
    const firstEnvelope = first as { ok: boolean; data?: WorkspaceApplyDesignResult };
    const firstToken = firstEnvelope.ok ? firstEnvelope.data?.transactionToken : null;
    const retry = await tools[5].execute(operation, {});
    expect(retry).toMatchObject({ ok: true, data: { transactionToken: firstToken }, warnings: [expect.stringContaining("already applied")] });
    expect(design.template.layers.filter(({ id }) => id === "layer_agent_badge")).toHaveLength(1);

    await expect(tools[5].execute({ ...operation, edits: [{ type: "set-background", background: "#000000" }] }, {}))
      .resolves.toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });

    design = { ...design, template: { ...design.template, background: "#166534" } };
    current = { ...current, draftRevision: 2 };
    await expect(tools[5].execute({
      ...identity(), targetId: "master", expectedDraftRevision: 1, operationId: "op-stale", edits: [{ type: "set-background", background: "#2563eb" }],
    }, {})).resolves.toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(design.template.background).toBe("#166534");

    current = { ...current, data: { ...current.data, design: { ...current.data.design, activeTargetId: "placement:4:5" } } };
    design = { targetId: "placement:4:5", template: { ...design.template, id: "tpl_variant_4x5", sizeId: "4:5", height: 1350 } };
    await expect(tools[5].execute({
      ...identity(), targetId: "master", expectedDraftRevision: 2, operationId: "op-wrong-target", edits: [{ type: "set-background", background: "#2563eb" }],
    }, {})).resolves.toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(design.template.background).toBe("#166534");

    const readOnlyTools = createAgentWorkspaceTools(() => current, {
      readCatalog: () => ({ projectId: PROJECT_ID, revision: 4, products, validation: validateCatalog(products) }),
      readDesign: () => design,
    });
    expect(readOnlyTools.map(({ name }) => name)).toEqual([
      "catalog_forge_get_context",
      "catalog_forge_query_products",
      "catalog_forge_get_validation",
      "catalog_forge_get_design",
    ]);
  });
});
