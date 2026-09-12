"use client";

import type { WorkspaceAgentActivity } from "@/workspace/contracts";

type Props = {
  activities: WorkspaceAgentActivity[];
  available: boolean;
  paused: boolean;
  canUndo: boolean;
  notice: string | null;
  onPausedChange: (paused: boolean) => void;
  onUndo: (transactionToken: string) => void;
};

function activitySummary(activity: WorkspaceAgentActivity): string {
  const verb = activity.status === "undone" ? "Undid" : "Changed";
  const design = activity.result.diff.some(({ layerId }) => layerId === null) ? " design" : "";
  const layers = activity.changedLayerIds.length > 0
    ? ` · ${activity.changedLayerIds.length} ${activity.changedLayerIds.length === 1 ? "layer" : "layers"}`
    : "";
  return `${verb}${design}${layers}`;
}

export function AgentActivity({ activities, available, paused, canUndo, notice, onPausedChange, onUndo }: Props) {
  const recent = activities.slice(-5).reverse();
  const latest = recent[0];

  return (
    <section aria-label="Agent activity" className="border-b border-violet-200 bg-violet-50/70 px-4 py-2 text-xs text-zinc-700">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-violet-950">Agent tools</strong>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-600">
          {!available ? "Unavailable in this browser" : paused ? "Edits paused" : "Available"}
        </span>
        <button
          type="button"
          aria-pressed={paused}
          disabled={!available}
          onClick={() => onPausedChange(!paused)}
          className="rounded border border-violet-300 bg-white px-2 py-1 font-medium text-violet-900 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {paused ? "Resume agent edits" : "Pause agent edits"}
        </button>
        {latest?.status === "applied" && (
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => onUndo(latest.transactionToken)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            Undo latest change
          </button>
        )}
        <span className="ml-auto text-[11px] text-zinc-500">Draft only · Save when ready</span>
      </div>

      {notice && <p role="status" className="mt-1 text-[11px] text-violet-900">{notice}</p>}

      {recent.length > 0 && (
        <ol className="mt-2 flex max-h-24 flex-col gap-1 overflow-y-auto" aria-label="Recent agent changes">
          {recent.map((activity) => (
            <li key={activity.transactionToken} className="flex flex-wrap items-center gap-x-2 rounded bg-white/80 px-2 py-1">
              <span className="font-medium text-zinc-900">
                {activitySummary(activity)}
              </span>
              <span>{activity.targetId}</span>
              <span className="font-mono text-[10px] text-zinc-500">{activity.operationId}</span>
              <span className="text-[10px] text-zinc-500">
                draft {activity.beforeDraftRevision}→{activity.afterDraftRevision}
                {activity.undoDraftRevision !== undefined ? `→${activity.undoDraftRevision}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
