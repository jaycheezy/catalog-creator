---
id: "c-agent-design-commands"
slice: "agent-assisted-workspace"
title: "A4 · Co-edit the overlay with typed tools"
step: "design"
status: "proposed"
effort: "L"
order: 3
tags: []
dependsOn: ["c-agent-workspace-context"]
implementation: "specified"
value: "Lets an assistant make small, visible design changes for you on request, so updating prices and badges takes seconds instead of manual edits."
---

# A4 · Co-edit the overlay with typed tools

## Summary

Expose get_design, set_view and apply_design_changes for bounded, visible edits to the active draft.

## Acceptance criteria

- Support allowlisted background, layer content, geometry, style, visibility, add and remove operations; respect locked layers.
- Validate a whole batch before committing, require current draft revision, and return the resulting diff and revision.
- Repeated operation IDs do not duplicate edits; unknown IDs, unsupported bindings and arbitrary code/HTML are rejected.
- Changes update the same canvas and dirty state as manual edits; tools do not save or publish.

## Scope

Own get_design, set_view and apply_design_changes. Support atomic typed draft edits using existing assets and bindings. Exclude remote asset loading, raw HTML/CSS execution, source edits, save, publication and conditional badge logic.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read `src/editor/types.ts`, `src/editor/PropertiesPanel.tsx`, `src/editor/EditorCanvas.tsx`, `src/editor/bindings.ts` and A2’s controller. Add a discriminated edit union for set-background, add-layer, update-layer and remove-layer. Validate the full batch on a copy before committing. Respect locked layers, finite geometry, positive dimensions, unique IDs, supported bindings and allowlisted styles. Return explicit errors instead of silently falling back. Selection changes use viewRevision; design changes use draftRevision. Update visible editor state through the shared controller.

## Interfaces

Extend `src/workspace/contracts.ts` and implement edit handling in `src/workspace/designCommands.ts`. Require sessionId, projectId, expectedDraftRevision and operationId for batches, max 20 edits. Deduplicate by operation ID plus canonical input, checking prior receipts before stale-revision rejection on an identical retry. Conflicting operation-ID reuse fails. Return diff, changed layer IDs, new revision and a transaction token. Record before/after snapshots through a bounded history interface for A5; A5 owns the undo UI/tool, not a second mutation engine.

## Validation

Test a mixed valid/invalid batch has zero effect, stale revisions preserve human edits, retries add only one layer, locked/unknown layers fail, hostile CSS URLs and unsupported bindings fail, and manual edits are reflected immediately in tool reads. Verify the canvas and saved/dirty status after a real tool call.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.
