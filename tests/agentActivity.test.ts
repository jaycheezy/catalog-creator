import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentActivity } from "@/components/AgentActivity";
import { LayersPanel } from "@/editor/LayersPanel";
import type { Template } from "@/editor/types";
import type { WorkspaceAgentActivity } from "@/workspace/contracts";

const template: Template = {
  id: "tpl_activity",
  name: "Activity fixture",
  sizeId: "1:1",
  width: 1080,
  height: 1080,
  background: "#ffffff",
  layers: [{
    id: "layer_title",
    type: "text",
    name: "Title",
    x: 80,
    y: 800,
    w: 920,
    h: 80,
    rotation: 0,
    z: 1,
    visible: true,
    locked: false,
    style: { color: "#111111" },
    content: "{{title}}",
  }],
  createdAt: 1,
  updatedAt: 2,
};

const activity: WorkspaceAgentActivity = {
  actor: "agent",
  operationId: "op-readable-title",
  transactionToken: "txn_activity",
  targetId: "master",
  changedLayerIds: ["layer_title"],
  beforeDraftRevision: 3,
  afterDraftRevision: 4,
  createdAt: 5,
  status: "applied",
  result: {
    operationId: "op-readable-title",
    transactionToken: "txn_activity",
    targetId: "master",
    appliedDraftRevision: 4,
    changedLayerIds: ["layer_title"],
    diff: [],
    persisted: false,
  },
};

describe("agent activity UI", () => {
  it("renders activity with native keyboard controls and a clear availability state", () => {
    const html = renderToStaticMarkup(createElement(AgentActivity, {
      activities: [activity],
      available: true,
      paused: false,
      canUndo: true,
      notice: null,
      onPausedChange: () => {},
      onUndo: () => {},
    }));
    expect(html).toContain('aria-label="Agent activity"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Available");
    expect(html).toContain("Pause agent edits");
    expect(html).toContain("Undo latest");
    expect(html).toContain("op-readable-title");
    expect(html).not.toContain("connected");
  });

  it("labels changed layers in the existing layer list", () => {
    const html = renderToStaticMarkup(createElement(LayersPanel, {
      template,
      selectedId: null,
      highlightedIds: ["layer_title"],
      onSelect: () => {},
      onUpdate: () => {},
      onAdd: () => {},
      onDelete: () => {},
      onDuplicate: () => {},
    }));
    expect(html).toContain("Changed by agent");
    expect(html).toContain("ring-violet-300");
  });
});
