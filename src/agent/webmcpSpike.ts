import {
  ensureWebMcpNotAborted,
  getWebMcpModelContext,
  registerWebMcpTools,
  type WebMcpModelContext,
  type WebMcpTool,
} from "./webmcp";

export { describeWebMcpError } from "./webmcp";
export type { WebMcpModelContext, WebMcpTool } from "./webmcp";

export type SpikeContext = {
  sessionId: string;
  projectId: string | null;
  templateId: string;
  templateName: string;
  background: string;
};

export type SpikeRegistration =
  | { supported: false; reason: "webmcp-unavailable" }
  | { supported: true; cleanup: () => void };

type RegistrationOptions = {
  getContext: () => SpikeContext;
  setBackground: (background: string) => void;
  modelContext?: WebMcpModelContext | null;
};

type BackgroundInput = { background?: unknown };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function readBackground(input: unknown): string {
  const value = (input && typeof input === "object" ? input as BackgroundInput : {}).background;
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error("background must be a six-digit hexadecimal color such as #0f5132");
  }
  return value.toLowerCase();
}

export async function registerWebMcpSpikeTools(options: RegistrationOptions): Promise<SpikeRegistration> {
  const modelContext = options.modelContext === undefined ? getWebMcpModelContext() : options.modelContext;
  const getContext: WebMcpTool = {
    name: "catalog_forge_spike_get_context",
    title: "Catalog Forge spike context",
    description: "Returns the current development editor context without credentials, cookies, product rows or save URLs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: (_input, toolOptions) => {
      ensureWebMcpNotAborted(toolOptions?.signal);
      const context = options.getContext();
      return {
        ok: true,
        schemaVersion: 1,
        sessionId: context.sessionId,
        projectId: context.projectId,
        templateId: context.templateId,
        templateName: context.templateName,
        background: context.background,
        persisted: false,
      };
    },
  };
  const setBackground: WebMcpTool = {
    name: "catalog_forge_spike_set_background",
    title: "Set temporary Catalog Forge background",
    description: "Changes only the current editor draft background to a validated hexadecimal color. This is a temporary, unsaved probe action; use the returned before value to restore it.",
    inputSchema: {
      type: "object",
      properties: {
        background: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$",
          description: "Six-digit hexadecimal CSS color, for example #0f5132.",
        },
      },
      required: ["background"],
      additionalProperties: false,
    },
    execute: (input, toolOptions) => {
      ensureWebMcpNotAborted(toolOptions?.signal);
      const background = readBackground(input);
      const before = options.getContext().background;
      options.setBackground(background);
      return {
        ok: true,
        schemaVersion: 1,
        sessionId: options.getContext().sessionId,
        projectId: options.getContext().projectId,
        before,
        after: background,
        persisted: false,
      };
    },
  };

  return registerWebMcpTools([getContext, setBackground], modelContext);
}
