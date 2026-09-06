export type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, options: { signal?: AbortSignal }) => unknown | Promise<unknown>;
  annotations?: { readOnlyHint?: boolean };
};

export type WebMcpModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

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

/**
 * WebMCP implementations can reject registration with a structured value
 * instead of an Error. Keep the probe diagnostic useful without exposing a
 * browser object or a stack trace.
 */
export function describeWebMcpError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const encoded = JSON.stringify(error);
    if (encoded && encoded !== "{}") return encoded;
  } catch {}
  return String(error);
}

export function getWebMcpModelContext(): WebMcpModelContext | null {
  if (typeof document !== "undefined") {
    const current = (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
    if (current && typeof current.registerTool === "function") return current;
  }
  if (typeof navigator !== "undefined") {
    const legacy = (navigator as Navigator & { modelContext?: WebMcpModelContext }).modelContext;
    if (legacy && typeof legacy.registerTool === "function") return legacy;
  }
  return null;
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("The WebMCP probe action was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function readBackground(input: unknown): string {
  const value = (input && typeof input === "object" ? input as BackgroundInput : {}).background;
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error("background must be a six-digit hexadecimal color such as #0f5132");
  }
  return value.toLowerCase();
}

export async function registerWebMcpSpikeTools(options: RegistrationOptions): Promise<SpikeRegistration> {
  const modelContext = options.modelContext === undefined ? getWebMcpModelContext() : options.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return { supported: false, reason: "webmcp-unavailable" };
  }

  const controller = new AbortController();
  const getContext: WebMcpTool = {
    name: "catalog_forge_spike_get_context",
    title: "Catalog Forge spike context",
    description: "Returns the current development editor context without credentials, cookies, product rows or save URLs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: (_input, toolOptions) => {
      ensureNotAborted(toolOptions?.signal);
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
      ensureNotAborted(toolOptions?.signal);
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

  try {
    await modelContext.registerTool(getContext, { signal: controller.signal });
    await modelContext.registerTool(setBackground, { signal: controller.signal });
  } catch (error) {
    controller.abort();
    throw error;
  }

  let cleaned = false;
  return {
    supported: true,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      controller.abort();
    },
  };
}
