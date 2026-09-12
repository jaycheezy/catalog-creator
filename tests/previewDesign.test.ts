import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createAgentWorkspaceTools } from "@/agent/tools";
import { AgentReviewGrid } from "@/components/AgentReviewGrid";
import type { FeedRow } from "@/lib/facebook";
import { validateCatalog } from "@/lib/catalogValidation";
import { templateFingerprint } from "@/editor/saveState";
import type { Layer, Template } from "@/editor/types";
import {
  workspaceCapabilities,
  type WorkspaceContextSnapshot,
  type WorkspaceReviewState,
} from "@/workspace/contracts";
import { clonePreviewTemplate, parsePreviewDesignInput } from "@/workspace/previewCommands";

const SESSION_ID = "workspace_preview_fixture";
const PROJECT_ID = "prj_preview_fixture";

function layer(overrides: Partial<Layer>): Layer {
  return {
    id: "layer_title",
    type: "text",
    name: "Title",
    x: 80,
    y: 800,
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

function designTemplate(): Template {
  return {
    id: "tpl_preview_fixture",
    name: "Preview fixture",
    sizeId: "1:1",
    width: 1080,
    height: 1080,
    background: "#ffffff",
    layers: [
      layer({ id: "layer_image", type: "product-image", name: "Image", y: 40, h: 700, objectFit: "contain" }),
      layer({}),
      layer({ id: "layer_sale", type: "badge", name: "Sale", y: 900, h: 70, content: "{{discount_pct}}% OFF" }),
    ],
    createdAt: 1,
    updatedAt: 2,
    revision: 4,
  };
}

function product(index: number, overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: `SKU-${index}`,
    source_id: `shopify:variant:${index}`,
    title: `Product ${index}`,
    description: "A complete fixture product description.",
    availability: "in stock",
    condition: "new",
    price: "20.00 EUR",
    link: `https://shop.example/products/${index}`,
    image_link: `https://cdn.example/${index}.jpg`,
    brand: "Fixture",
    ...overrides,
  };
}

function workspaceContext(): WorkspaceContextSnapshot {
  return {
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    draftRevision: 3,
    viewRevision: 7,
    data: {
      busy: { loading: false, saving: false, publishing: false },
      project: {
        name: "Preview fixture",
        source: { type: "csv", format: "csv", currencyCodes: ["EUR"] },
        productCount: 4,
        totalProducts: 4,
        totalRows: 4,
        importComplete: true,
        validation: { status: "ready", errors: 0, warnings: 0, imageChecks: "not-run" },
      },
      design: {
        activeTargetId: "master",
        activeSizeId: "1:1",
        masterSizeId: "1:1",
        activeSaved: true,
        dirty: false,
        savedProjectRevision: 5,
        savedTemplateRevision: 4,
        placements: [{ sizeId: "1:1", targetId: "master", active: true, open: true, saved: true, savedRevision: 4 }],
      },
      view: { mode: "canvas", selectedProductId: "shopify:variant:1", selectedLayerId: "layer_title" },
      publication: { status: "not-published", publishedProjectRevision: null, draftNewer: false },
      agent: { mutationsAvailable: true, paused: false, activityCount: 0, canUndo: false },
      capabilities: workspaceCapabilities([]),
    },
  };
}

function previewInput(productIds = ["shopify:variant:1", "shopify:variant:2", "shopify:variant:3"], sizeIds = ["1:1", "4:5", "9:16", "1.91:1"]) {
  return { sessionId: SESSION_ID, projectId: PROJECT_ID, expectedDraftRevision: 3, productIds, sizeIds };
}

describe("preview design command", () => {
  it("validates explicit unique products, supported sizes, and the 12-cell bound", () => {
    expect(parsePreviewDesignInput(previewInput())).toMatchObject({ ok: true });
    expect(parsePreviewDesignInput(previewInput(["a", "b", "c", "d"], ["1:1", "4:5", "9:16", "1.91:1"])))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT", message: expect.stringContaining("12") } });
    expect(parsePreviewDesignInput(previewInput(["a"], ["2:3"])))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT", message: "Unsupported sizeId: 2:3." } });
    expect(parsePreviewDesignInput(previewInput(["a", "a"], ["1:1"])))
      .toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT", message: expect.stringContaining("duplicate") } });
  });

  it("opens one bounded review only after validating every product and preserves active state", async () => {
    const products = [product(1), product(2), product(3)];
    const sourceTemplate = designTemplate();
    const originalFingerprint = templateFingerprint(sourceTemplate);
    let current = workspaceContext();
    let committedReview: WorkspaceReviewState | null = null;
    let commits = 0;
    const tools = createAgentWorkspaceTools(() => current, {
      readCatalog: () => ({ projectId: PROJECT_ID, revision: 5, products, validation: validateCatalog(products) }),
      readDesign: () => ({ targetId: "master", template: sourceTemplate }),
      commitPreview: (review) => {
        commits += 1;
        committedReview = review;
        current = {
          ...current,
          viewRevision: current.viewRevision + 1,
          data: { ...current.data, view: { ...current.data.view, mode: "all-sizes" } },
        };
        return current;
      },
    });
    const preview = tools.find(({ name }) => name === "catalog_forge_preview_design");
    expect(preview).toBeDefined();

    await expect(preview!.execute(previewInput(), {})).resolves.toMatchObject({
      ok: true,
      draftRevision: 3,
      viewRevision: 8,
      data: {
        viewId: expect.stringMatching(/^view_/),
        capturedDraftRevision: 3,
        targetId: "master",
        surface: "browser-draft",
        persisted: false,
        cells: expect.arrayContaining([
          { sourceId: "shopify:variant:1", sizeId: "1:1", width: 1080, height: 1080 },
          { sourceId: "shopify:variant:3", sizeId: "9:16", width: 1080, height: 1920 },
        ]),
      },
      warnings: [expect.stringContaining("No templates were saved")],
    });
    expect(commits).toBe(1);
    expect(committedReview).toMatchObject({ productIds: previewInput().productIds, sizeIds: previewInput().sizeIds });
    expect(current.data.view.selectedProductId).toBe("shopify:variant:1");
    expect(current.data.view.selectedLayerId).toBe("layer_title");
    expect(current.data.design.activeSaved).toBe(true);
    expect(current.data.design.dirty).toBe(false);
    expect(templateFingerprint(sourceTemplate)).toBe(originalFingerprint);

    const captured = committedReview as unknown as WorkspaceReviewState;
    captured.template.layers[0].style.background = "#000000";
    expect(sourceTemplate.layers[0].style.background).toBeUndefined();
  });

  it("rejects missing products, oversized requests, pause, and a draft change without opening partial UI", async () => {
    const products = [product(1), product(2), product(3), product(4)];
    let current = workspaceContext();
    let paused = false;
    let commits = 0;
    let releaseAuth: ((value: boolean) => void) | undefined;
    const verifySession = () => new Promise<boolean>((resolve) => { releaseAuth = resolve; });
    const options = {
      readCatalog: () => ({ projectId: PROJECT_ID, revision: 5, products, validation: validateCatalog(products) }),
      readDesign: () => ({ targetId: "master" as const, template: designTemplate() }),
      commitPreview: () => { commits += 1; return current; },
      isPaused: () => paused,
    };

    const immediateTools = createAgentWorkspaceTools(() => current, options);
    const immediatePreview = immediateTools.find(({ name }) => name === "catalog_forge_preview_design")!;
    await expect(immediatePreview.execute(previewInput(["shopify:variant:missing"], ["1:1"]), {}))
      .resolves.toMatchObject({ ok: false, error: { code: "PRODUCT_NOT_FOUND" } });
    await expect(immediatePreview.execute(previewInput(products.map(({ source_id }) => source_id!), ["1:1", "4:5", "9:16", "1.91:1"]), {}))
      .resolves.toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    paused = true;
    await expect(immediatePreview.execute(previewInput(["shopify:variant:1"], ["1:1"]), {}))
      .resolves.toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPERATION" } });
    paused = false;

    const delayedTools = createAgentWorkspaceTools(() => current, { ...options, verifySession });
    const delayedPreview = delayedTools.find(({ name }) => name === "catalog_forge_preview_design")!;
    const pending = delayedPreview.execute(previewInput(["shopify:variant:1"], ["1:1"]), {});
    current = { ...current, draftRevision: 4 };
    releaseAuth?.(true);
    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(commits).toBe(0);
  });
});

describe("agent review grid", () => {
  it("renders exact source and placement labels with long-title, sale, and missing-image cases", () => {
    const products = [
      product(1, { title: "A very long catalog product title that must remain visible for review across narrow placements" }),
      product(2, { title: "Sale product", sale_price: "15.00 EUR" }),
      product(3, { id: "MISSING-IMAGE", title: "Missing image product", image_link: "" }),
    ];
    const review: WorkspaceReviewState = {
      viewId: "view_fixture",
      capturedDraftRevision: 3,
      targetId: "master",
      productIds: products.map(({ source_id }) => source_id!),
      sizeIds: ["1:1", "9:16"],
      template: clonePreviewTemplate(designTemplate()),
    };
    const html = renderToStaticMarkup(createElement(AgentReviewGrid, { review, products, onClose: () => {} }));
    expect(html).toContain("revision 3");
    expect(html).toContain("A very long catalog product title that must remain visible");
    expect(html).toContain("shopify:variant:2");
    expect(html).toContain("1:1 · 1080×1080");
    expect(html).toContain("9:16 · 1080×1920");
    expect(html).toContain("Sale · 15.00 EUR");
    expect(html).toContain("25% OFF");
    expect(html).toContain("No image — MISSING-IMAGE");
    expect(html.match(/<article/g)).toHaveLength(6);
  });
});
