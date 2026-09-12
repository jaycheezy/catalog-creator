"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createAgentWorkspaceTools } from "@/agent/tools";
import { registerWebMcpTools } from "@/agent/webmcp";
import type { WorkspaceCatalogSnapshot } from "@/agent/catalogQueries";
import { AgentActivity } from "@/components/AgentActivity";
import { WorkspaceDesignHistory } from "@/workspace/designCommands";
import type {
  WorkspaceAgentActivity,
  WorkspaceContextSnapshot,
  WorkspaceDesignSnapshot,
  WorkspaceDraftTargetId,
  WorkspaceReviewState,
  WorkspaceViewChange,
} from "@/workspace/contracts";
import type { Template } from "@/editor/types";

type Props = {
  context: Omit<WorkspaceContextSnapshot, "sessionId">;
  catalog: WorkspaceCatalogSnapshot;
  design: WorkspaceDesignSnapshot;
  onApplyDesign: (targetId: WorkspaceDraftTargetId, template: Template, clearSelectedLayer: boolean) => void;
  onSetView: (change: WorkspaceViewChange) => void;
  onPreviewDesign: (review: WorkspaceReviewState) => void;
  onHighlightLayers: (layerIds: string[]) => void;
};

function newWorkspaceSessionId(): string {
  try {
    if ("randomUUID" in crypto) return `workspace_${crypto.randomUUID().replace(/-/g, "")}`;
  } catch {}
  return `workspace_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function AgentWorkspaceProvider({ context, catalog, design, onApplyDesign, onSetView, onPreviewDesign, onHighlightLayers }: Props) {
  const [sessionId] = useState(newWorkspaceSessionId);
  const [authorized, setAuthorized] = useState(true);
  const [toolsAvailable, setToolsAvailable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activities, setActivities] = useState<WorkspaceAgentActivity[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const contextRef = useRef<WorkspaceContextSnapshot>({ ...context, sessionId });
  const catalogRef = useRef(catalog);
  const designRef = useRef(design);
  const onApplyDesignRef = useRef(onApplyDesign);
  const onSetViewRef = useRef(onSetView);
  const onPreviewDesignRef = useRef(onPreviewDesign);
  const onHighlightLayersRef = useRef(onHighlightLayers);
  const designHistoryRef = useRef(new WorkspaceDesignHistory());
  const pausedRef = useRef(false);

  const latestActivity = activities.at(-1);
  const canUndo = Boolean(
    latestActivity?.status === "applied"
    && latestActivity.afterDraftRevision === context.draftRevision
    && latestActivity.targetId === design.targetId
  );

  useLayoutEffect(() => {
    contextRef.current = {
      ...context,
      sessionId,
      data: {
        ...context.data,
        agent: {
          mutationsAvailable: authorized && toolsAvailable,
          paused,
          activityCount: activities.length,
          canUndo,
        },
      },
    };
    catalogRef.current = catalog;
    designRef.current = design;
    onApplyDesignRef.current = onApplyDesign;
    onSetViewRef.current = onSetView;
    onPreviewDesignRef.current = onPreviewDesign;
    onHighlightLayersRef.current = onHighlightLayers;
  }, [activities.length, authorized, canUndo, catalog, context, design, onApplyDesign, onHighlightLayers, onPreviewDesign, onSetView, paused, sessionId, toolsAvailable]);

  const commitDesign = useCallback((change: {
    targetId: WorkspaceDraftTargetId;
    template: Template;
    clearSelectedLayer: boolean;
  }) => {
    const current = contextRef.current;
    const committed: WorkspaceContextSnapshot = {
      ...current,
      draftRevision: current.draftRevision + 1,
      viewRevision: current.viewRevision + (change.clearSelectedLayer ? 1 : 0),
      data: {
        ...current.data,
        design: { ...current.data.design, activeSaved: false, dirty: true },
        view: {
          ...current.data.view,
          ...(change.clearSelectedLayer ? { selectedLayerId: null } : {}),
        },
      },
    };
    contextRef.current = committed;
    designRef.current = { targetId: change.targetId, template: change.template };
    onApplyDesignRef.current(change.targetId, change.template, change.clearSelectedLayer);
    return committed;
  }, []);

  const commitView = useCallback((change: WorkspaceViewChange) => {
    const current = contextRef.current;
    const selectedProductId = change.productIndex === undefined
      ? current.data.view.selectedProductId
      : catalogRef.current.products[change.productIndex]?.source_id?.trim() ?? null;
    const committed: WorkspaceContextSnapshot = {
      ...current,
      viewRevision: current.viewRevision + 1,
      data: {
        ...current.data,
        view: {
          mode: change.panel ?? current.data.view.mode,
          selectedProductId,
          selectedLayerId: change.layerId === undefined ? current.data.view.selectedLayerId : change.layerId,
        },
      },
    };
    contextRef.current = committed;
    onSetViewRef.current(change);
    return committed;
  }, []);

  const commitPreview = useCallback((review: WorkspaceReviewState) => {
    const current = contextRef.current;
    const committed: WorkspaceContextSnapshot = {
      ...current,
      viewRevision: current.viewRevision + 1,
      data: {
        ...current.data,
        view: { ...current.data.view, mode: "all-sizes" },
      },
    };
    contextRef.current = committed;
    onPreviewDesignRef.current(review);
    return committed;
  }, []);

  const recordActivity = useCallback((activity: WorkspaceAgentActivity) => {
    setActivities((previous) => [...previous, activity].slice(-50));
    onHighlightLayersRef.current(activity.changedLayerIds);
    setNotice(null);
    contextRef.current = {
      ...contextRef.current,
      data: {
        ...contextRef.current.data,
        agent: {
          ...contextRef.current.data.agent,
          activityCount: Math.min(contextRef.current.data.agent.activityCount + 1, 50),
          canUndo: true,
        },
      },
    };
  }, []);

  const markActivityUndone = useCallback((transactionToken: string, undoDraftRevision: number) => {
    setActivities((previous) => previous.map((activity) => activity.transactionToken === transactionToken
      ? { ...activity, status: "undone", undoDraftRevision }
      : activity));
    onHighlightLayersRef.current([]);
    contextRef.current = {
      ...contextRef.current,
      data: {
        ...contextRef.current.data,
        agent: { ...contextRef.current.data.agent, canUndo: false },
      },
    };
  }, []);

  const setAgentPaused = useCallback((next: boolean) => {
    pausedRef.current = next;
    setPaused(next);
    setNotice(next ? "New agent view and design commands will stop before changing the workspace." : null);
    contextRef.current = {
      ...contextRef.current,
      data: {
        ...contextRef.current.data,
        agent: { ...contextRef.current.data.agent, paused: next },
      },
    };
  }, []);

  const undoFromEditor = useCallback((transactionToken: string) => {
    const current = contextRef.current;
    const currentDesign = designRef.current;
    const prepared = designHistoryRef.current.prepareUndo({
      undoToken: transactionToken,
      expectedDraftRevision: current.draftRevision,
      targetId: currentDesign.targetId,
      template: currentDesign.template,
    });
    if (!prepared.ok) {
      setNotice(prepared.error.message);
      return;
    }
    const selectedLayerId = current.data.view.selectedLayerId;
    const committed = commitDesign({
      targetId: prepared.data.entry.result.targetId,
      template: prepared.data.template,
      clearSelectedLayer: Boolean(selectedLayerId && !prepared.data.template.layers.some(({ id }) => id === selectedLayerId)),
    });
    designHistoryRef.current.consumeUndo(transactionToken);
    markActivityUndone(transactionToken, committed.draftRevision);
    setNotice("Latest agent design change undone. Review the editor's Save status before continuing.");
  }, [commitDesign, markActivityUndone]);

  const verifySession = useCallback(async () => {
    try {
      const response = await fetch("/api/login", { cache: "no-store" });
      if (!response.ok) {
        setAuthorized(false);
        return false;
      }
      const status = await response.json() as { configured?: boolean; authenticated?: boolean };
      const current = !status.configured || Boolean(status.authenticated);
      if (!current) setAuthorized(false);
      return current;
    } catch {
      throw new Error("Could not verify the editor session");
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const recheckOnFocus = () => { void verifySession().catch(() => {}); };
    window.addEventListener("focus", recheckOnFocus);
    return () => window.removeEventListener("focus", recheckOnFocus);
  }, [authorized, verifySession]);

  useEffect(() => {
    if (!authorized) return;
    const designHistory = designHistoryRef.current;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // Match the A1 lifecycle proof: defer registration past React Strict
    // Mode's discarded development mount to avoid duplicate tool names.
    void Promise.resolve().then(async () => {
      if (disposed) return;
      const registration = await registerWebMcpTools(
        createAgentWorkspaceTools(() => contextRef.current, {
          verifySession,
          readCatalog: () => catalogRef.current,
          readDesign: () => designRef.current,
          commitDesign,
          commitView,
          commitPreview,
          designHistory,
          isPaused: () => pausedRef.current,
          recordActivity,
          markActivityUndone,
        }),
      );
      if (disposed) {
        if (registration.supported) registration.cleanup();
        return;
      }
      if (registration.supported) {
        cleanup = registration.cleanup;
        setToolsAvailable(true);
      }
    }).catch(() => {
      // Unsupported or changing draft APIs must not break the ordinary editor.
    });

    return () => {
      disposed = true;
      cleanup?.();
      designHistory.clear();
    };
  }, [authorized, commitDesign, commitPreview, commitView, markActivityUndone, recordActivity, verifySession]);

  return (
    <AgentActivity
      activities={activities}
      available={authorized && toolsAvailable}
      paused={paused}
      canUndo={canUndo}
      notice={notice}
      onPausedChange={setAgentPaused}
      onUndo={undoFromEditor}
    />
  );
}
