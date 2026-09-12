import { describe, expect, it } from "vitest";
import { AGENT_WORKSPACE_TOOL_NAMES, createAgentWorkspaceTools } from "@/agent/tools";
import { registerWebMcpTools, type WebMcpModelContext, type WebMcpTool } from "@/agent/webmcp";
import {
  workspaceCapabilities,
  workspaceSourceSummary,
  type WorkspaceContextSnapshot,
} from "@/workspace/contracts";
import {
  INITIAL_WORKSPACE_REVISION,
  validateWorkspaceCommandIdentity,
  workspaceRevisionReducer,
} from "@/workspace/controller";
import { validateCatalog } from "@/lib/catalogValidation";
import type { FeedRow } from "@/lib/facebook";

function context(draftRevision = 0): WorkspaceContextSnapshot {
  return {
    sessionId: "workspace_session",
    projectId: "prj_fixture123456",
    draftRevision,
    viewRevision: 2,
    data: {
      busy: { loading: false, saving: false, publishing: false },
      project: {
        name: "Fixture catalog",
        source: { type: "store", platform: "shopify", currencyCodes: ["EUR"] },
        productCount: 31,
        totalProducts: 31,
        totalRows: 31,
        importComplete: true,
        validation: { status: "needs-review", errors: 0, warnings: 2, imageChecks: "not-run" },
      },
      design: {
        activeTargetId: "master",
        activeSizeId: "1:1",
        masterSizeId: "1:1",
        activeSaved: false,
        dirty: true,
        savedProjectRevision: 4,
        savedTemplateRevision: 3,
        placements: [
          { sizeId: "1:1", targetId: "master", active: true, open: true, saved: false, savedRevision: 3 },
        ],
      },
      view: { mode: "canvas", selectedProductId: "shopify:variant:1", selectedLayerId: "layer_title" },
      publication: { status: "published", publishedProjectRevision: 3, draftNewer: true },
      agent: { mutationsAvailable: true, paused: false, activityCount: 0, canUndo: false },
      capabilities: workspaceCapabilities([...AGENT_WORKSPACE_TOOL_NAMES]),
    },
  };
}

describe("agent workspace context", () => {
  it("removes source values that can contain private URLs", () => {
    expect(workspaceSourceSummary({ type: "feed-url", value: "https://secret.example/feed.csv?token=private", format: "csv" }))
      .toEqual({ type: "feed-url", format: "csv", currencyCodes: [] });
    expect(workspaceSourceSummary({
      type: "store",
      value: "https://shop.example",
      platform: "shopify",
      currencyCodes: ["EUR"],
      currencySource: "shopify-cart",
    })).toEqual({ type: "store", platform: "shopify", currencyCodes: ["EUR"] });
  });

  it("registers a bounded read-only tool that reads current state at execution time", async () => {
    const registered: WebMcpTool[] = [];
    let registrationSignal: AbortSignal | undefined;
    const modelContext: WebMcpModelContext = {
      registerTool: async (tool, options) => {
        registered.push(tool);
        registrationSignal = options?.signal;
      },
    };
    let current = context();
    const registration = await registerWebMcpTools(createAgentWorkspaceTools(() => current), modelContext);

    expect(registration.supported).toBe(true);
    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe("catalog_forge_get_context");
    expect(registered[0].annotations).toEqual({ readOnlyHint: true });
    current = context(7);
    const result = await registered[0].execute({}, { signal: new AbortController().signal });
    expect(result).toMatchObject({
      ok: true,
      schemaVersion: 1,
      sessionId: "workspace_session",
      projectId: "prj_fixture123456",
      draftRevision: 7,
      viewRevision: 2,
      data: {
        project: { productCount: 31, source: { type: "store", platform: "shopify" } },
        design: { activeTargetId: "master", dirty: true },
        agent: { mutationsAvailable: true, paused: false, activityCount: 0, canUndo: false },
        publication: { status: "published", draftNewer: true },
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret.example");
    expect(JSON.stringify(result)).not.toContain("token=private");

    if (!registration.supported) throw new Error("Expected WebMCP registration");
    registration.cleanup();
    expect(registrationSignal?.aborted).toBe(true);
  });

  it("returns bounded failures for unexpected arguments and cancellation", async () => {
    const tool = createAgentWorkspaceTools(() => context())[0];
    await expect(tool.execute(undefined, {})).resolves.toMatchObject({ ok: true, draftRevision: 0 });
    await expect(tool.execute({ projectId: "another" }, {})).resolves.toMatchObject({
      ok: false,
      draftRevision: 0,
      error: { code: "INVALID_ARGUMENT", retryable: false },
    });
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(tool.execute({}, { signal: cancellation.signal })).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED", retryable: false },
    });
  });

  it("rechecks authorization when the tool runs", async () => {
    const tool = createAgentWorkspaceTools(() => context(), { verifySession: () => false })[0];
    await expect(tool.execute({}, {})).resolves.toMatchObject({
      ok: false,
      error: { code: "AUTH_REQUIRED", retryable: false },
    });
    const unavailable = createAgentWorkspaceTools(() => context(), {
      verifySession: () => { throw new Error("network unavailable"); },
    })[0];
    await expect(unavailable.execute({}, {})).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: true },
    });
  });

  it("leaves unsupported browsers without a registration", async () => {
    await expect(registerWebMcpTools(createAgentWorkspaceTools(() => context()), null))
      .resolves.toEqual({ supported: false, reason: "webmcp-unavailable" });
  });

  it("registers catalog inspection tools against the saved snapshot", async () => {
    const row: FeedRow = {
      id: "SKU-1",
      source_id: "shopify:variant:1",
      title: "Fixture product",
      description: "A complete fixture product description.",
      availability: "in stock",
      condition: "new",
      price: "17.90 EUR",
      link: "https://shop.example/products/fixture",
      image_link: "https://cdn.example/fixture.jpg",
      brand: "Fixture Brand",
    };
    const registered: WebMcpTool[] = [];
    const tools = createAgentWorkspaceTools(() => context(), {
      readCatalog: () => ({
        projectId: "prj_fixture123456",
        revision: 4,
        products: [row],
        validation: validateCatalog([row]),
      }),
    });
    await registerWebMcpTools(tools, { registerTool: async (tool) => { registered.push(tool); } });
    expect(registered.map((tool) => tool.name)).toEqual(AGENT_WORKSPACE_TOOL_NAMES.slice(0, 3));
    expect(registered.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);

    await expect(registered[1].execute({
      sessionId: "workspace_session",
      projectId: "prj_fixture123456",
      sourceIds: ["shopify:variant:1"],
    }, {})).resolves.toMatchObject({ ok: true, data: { totalMatches: 1 } });
    await expect(registered[2].execute({
      sessionId: "workspace_stale",
      projectId: "prj_fixture123456",
    }, {})).resolves.toMatchObject({ ok: false, error: { code: "SESSION_CHANGED" } });
  });
});

describe("workspace command boundary", () => {
  it("tracks draft and view revisions independently and resets for a new project session", () => {
    const draft = workspaceRevisionReducer(INITIAL_WORKSPACE_REVISION, { type: "draft-changed", actor: "human" });
    const view = workspaceRevisionReducer(draft, { type: "view-changed", actor: "agent" });
    expect(view).toEqual({ draftRevision: 1, viewRevision: 1 });
    expect(workspaceRevisionReducer(view, { type: "reset" })).toEqual(INITIAL_WORKSPACE_REVISION);

    const otherTab = workspaceRevisionReducer(INITIAL_WORKSPACE_REVISION, { type: "view-changed", actor: "human" });
    expect(otherTab).toEqual({ draftRevision: 0, viewRevision: 1 });
    expect(view).toEqual({ draftRevision: 1, viewRevision: 1 });
  });

  it("rejects stale sessions, targets, and draft revisions explicitly", () => {
    const snapshot = context(7);
    expect(validateWorkspaceCommandIdentity(snapshot, {
      sessionId: snapshot.sessionId,
      projectId: snapshot.projectId,
      targetId: "master",
      expectedDraftRevision: 7,
    })).toBeNull();
    expect(validateWorkspaceCommandIdentity(snapshot, {
      sessionId: "workspace_stale",
      projectId: snapshot.projectId,
    })).toMatchObject({ error: { code: "SESSION_CHANGED" } });
    expect(validateWorkspaceCommandIdentity(snapshot, {
      sessionId: snapshot.sessionId,
      projectId: snapshot.projectId,
      targetId: "placement:4:5",
    })).toMatchObject({ error: { code: "REVISION_CONFLICT", retryable: true } });
    expect(validateWorkspaceCommandIdentity(snapshot, {
      sessionId: snapshot.sessionId,
      projectId: snapshot.projectId,
      expectedDraftRevision: 6,
    })).toMatchObject({ error: { code: "REVISION_CONFLICT", retryable: true } });
  });
});
