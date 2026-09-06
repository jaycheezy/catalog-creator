---
id: "c-agent-workspace-context"
slice: "agent-assisted-workspace"
title: "A2 · Share the active workspace with an agent"
step: "connect"
status: "proposed"
effort: "M"
order: 1
tags: []
dependsOn: ["c-agent-browser-spike"]
implementation: "specified"
value: "Lets you and an assistant work on the same live design together, so help happens where you are instead of starting over somewhere else."
---

# A2 · Share the active workspace with an agent

## Summary

Extract shared editor commands and add a thin WebMCP adapter plus get_context. Keep the agent and human on one live draft.

## Acceptance criteria

- Return active project, catalog completeness, selections, draft/saved revisions and supported capabilities without dumping the catalog or credentials.
- UI and tools use the same controller and current state; stale session/project references fail explicitly.
- Registration follows the eligible editor session, cleans up on teardown/logout, isolates tabs, and leaves unsupported browsers usable.

## Scope

Own the workspace controller, shared contracts, provider lifecycle, WebMCP adapter and get_context. The active project editor is the integration point. Exclude product search, draft batch edits, undo UI, and preview grids.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read `src/app/editor/page.tsx`, `src/editor/saveState.ts`, `src/lib/catalogProject.ts`, and the A1 report. Extract the state transitions required by existing editor controls without replacing import or save workflows. Use a controller that synchronously reads current state and serializes commands. Route every existing design mutation through the same draft revision increment, including resize, layer controls and JSON import. Keep loading, errors and saved fingerprints accurate. Attach the provider only to a loaded project. The adapter must use A1’s verified lifecycle API and clean up without leaking tools across sessions.

## Interfaces

Own `src/workspace/controller.ts`, `src/workspace/contracts.ts`, `src/agent/webmcp.ts`, `src/agent/tools.ts`, and `src/components/AgentWorkspaceProvider.tsx`. Expose a query for the current workspace, a subscription, and a typed command boundary. Define session/project identity, draftRevision, viewRevision, saved revisions, actor, dirty state and result/error envelopes as specified in the slice. Publish the extension points A3–A6 will use. get_context must remain bounded and exclude catalog dumps and capability feed URLs.

## Validation

Test current-state reads after manual changes, session replacement, mount/unmount, logout, loading failures, and two independent controller instances. Preserve existing manual save/reload regressions. Verify a browser lacking WebMCP can still edit and save. An adapter mock does not substitute for A1’s real browser evidence.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.
