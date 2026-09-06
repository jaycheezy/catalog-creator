"use client";

import { useEffect, useRef, useState } from "react";
import type { Template } from "@/editor/types";
import { describeWebMcpError, registerWebMcpSpikeTools, type SpikeContext } from "@/agent/webmcpSpike";

type Props = {
  projectId: string;
  template: Template;
  onSetBackground: (background: string) => void;
};

type ProbeStatus = "registering" | "registered" | "unsupported" | "error";

function newProbeSessionId(): string {
  try {
    if ("randomUUID" in crypto) return `spike_${crypto.randomUUID().replace(/-/g, "")}`;
  } catch {}
  return `spike_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function WebmcpSpike({ projectId, template, onSetBackground }: Props) {
  const [status, setStatus] = useState<ProbeStatus>("registering");
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(newProbeSessionId);
  const contextRef = useRef<SpikeContext | null>(null);
  const setBackgroundRef = useRef<(background: string) => void>(() => {});

  useEffect(() => {
    contextRef.current = { sessionId, projectId, templateId: template.id, templateName: template.name, background: template.background };
    setBackgroundRef.current = onSetBackground;
  }, [onSetBackground, projectId, sessionId, template.background, template.id, template.name]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // React Strict Mode runs an effect setup/cleanup pair before the real
    // development mount. Starting WebMCP registration synchronously lets
    // that throwaway mount race the real one and produce duplicate tools.
    void Promise.resolve().then(async () => {
      if (disposed) return;
      try {
        const result = await registerWebMcpSpikeTools({
          getContext: () => {
            if (!contextRef.current) throw new Error("The WebMCP probe context is not ready.");
            return contextRef.current;
          },
          setBackground: (background) => setBackgroundRef.current(background),
        });
        if (disposed) {
          if (result.supported) result.cleanup();
          return;
        }
        if (!result.supported) {
          setStatus("unsupported");
          return;
        }
        cleanup = result.cleanup;
        setStatus("registered");
      } catch (registrationError) {
        if (disposed) return;
        setStatus("error");
        setError(describeWebMcpError(registrationError));
      }
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <aside aria-label="WebMCP development probe" className="border-b border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-950">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong>Development WebMCP probe</strong>
        <span data-webmcp-probe-status>Registration: {status}</span>
        <span>Project: <code>{projectId}</code></span>
        <span>Draft background: <code>{template.background}</code></span>
        {error && <span role="alert">{error}</span>}
      </div>
      <div className="mt-1 text-[11px] text-violet-800">The spike tools are temporary, draft-only and removed when this editor session unmounts.</div>
    </aside>
  );
}
