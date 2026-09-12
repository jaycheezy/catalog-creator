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

export type WebMcpRegistration =
  | { supported: false; reason: "webmcp-unavailable" }
  | { supported: true; cleanup: () => void };

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

export function ensureWebMcpNotAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("The WebMCP operation was cancelled.");
  error.name = "AbortError";
  throw error;
}

export async function registerWebMcpTools(
  tools: WebMcpTool[],
  modelContext: WebMcpModelContext | null = getWebMcpModelContext(),
): Promise<WebMcpRegistration> {
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return { supported: false, reason: "webmcp-unavailable" };
  }

  const controller = new AbortController();
  try {
    for (const tool of tools) await modelContext.registerTool(tool, { signal: controller.signal });
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
