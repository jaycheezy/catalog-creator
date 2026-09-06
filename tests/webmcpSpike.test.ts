import { describe, expect, it } from "vitest";
import { describeWebMcpError, registerWebMcpSpikeTools, type WebMcpModelContext, type WebMcpTool } from "@/agent/webmcpSpike";

function context(background = "#ffffff") {
  return {
    sessionId: "spike_session",
    projectId: "prj_fixture123456",
    templateId: "tpl_fixture123456",
    templateName: "Fixture template",
    background,
  };
}

describe("WebMCP compatibility spike", () => {
  it("renders structured registration rejections without an opaque object string", () => {
    expect(describeWebMcpError({ name: "NotAllowedError", message: "WebMCP is disabled" }))
      .toBe('{"name":"NotAllowedError","message":"WebMCP is disabled"}');
  });

  it("registers a current-state query and reversible draft action with abort cleanup", async () => {
    const tools: WebMcpTool[] = [];
    let signal: AbortSignal | undefined;
    let current = context();
    const modelContext: WebMcpModelContext = {
      registerTool: async (tool, options) => {
        tools.push(tool);
        signal = options?.signal;
      },
    };
    const registration = await registerWebMcpSpikeTools({
      modelContext,
      getContext: () => current,
      setBackground: (background) => { current = { ...current, background }; },
    });

    expect(registration.supported).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual([
      "catalog_forge_spike_get_context",
      "catalog_forge_spike_set_background",
    ]);
    const readTool = tools[0];
    const actionTool = tools[1];
    const executionSignal = new AbortController().signal;
    expect(await readTool.execute({}, { signal: executionSignal })).toMatchObject({
      ok: true,
      projectId: "prj_fixture123456",
      background: "#ffffff",
      persisted: false,
    });
    expect(await actionTool.execute({ background: "#0f5132" }, { signal: executionSignal })).toMatchObject({
      before: "#ffffff",
      after: "#0f5132",
      persisted: false,
    });
    expect(current.background).toBe("#0f5132");
    expect(() => actionTool.execute({ background: "linear-gradient(red, blue)" }, { signal: executionSignal })).toThrowError(/six-digit hexadecimal/);

    if (!registration.supported) throw new Error("Expected supported WebMCP registration");
    registration.cleanup();
    expect(signal?.aborted).toBe(true);
    registration.cleanup();
  });

  it("degrades without WebMCP and does not create a registration", async () => {
    const result = await registerWebMcpSpikeTools({
      modelContext: null,
      getContext: () => context(),
      setBackground: () => {},
    });
    expect(result).toEqual({ supported: false, reason: "webmcp-unavailable" });
  });

  it("rejects cancelled actions before changing the draft", async () => {
    let changed = false;
    let action: WebMcpTool | undefined;
    const modelContext: WebMcpModelContext = {
      registerTool: async (tool) => {
        if (tool.name.endsWith("set_background")) action = tool;
      },
    };
    const registration = await registerWebMcpSpikeTools({
      modelContext,
      getContext: () => context(),
      setBackground: () => { changed = true; },
    });
    const controller = new AbortController();
    controller.abort();
    expect(registration.supported).toBe(true);
    const registeredAction = action;
    if (!registeredAction) throw new Error("Expected the background action to be registered");
    expect(() => registeredAction.execute({ background: "#0f5132" }, { signal: controller.signal })).toThrowError(/cancelled/);
    expect(changed).toBe(false);
    if (registration.supported) registration.cleanup();
  });
});
