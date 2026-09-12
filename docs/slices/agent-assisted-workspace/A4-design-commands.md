---
id: "c-agent-design-commands"
slice: "agent-assisted-workspace"
title: "A4 · Co-edit the overlay with typed tools"
step: "design"
status: "done"
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
- Every batch names `master` or a specific placement target, so switching the visible design cannot redirect an in-flight edit.

## Scope

Own get_design, set_view and apply_design_changes. Support atomic typed draft edits using existing assets and bindings. Exclude remote asset loading, raw HTML/CSS execution, source edits, save, publication and conditional badge logic.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read `src/editor/types.ts`, `src/editor/PropertiesPanel.tsx`, `src/editor/EditorCanvas.tsx`, `src/editor/bindings.ts` and A2’s controller. Add a discriminated edit union for set-background, add-layer, update-layer and remove-layer. Validate the full batch on a copy before committing. Respect locked layers, finite geometry, positive dimensions, unique IDs, supported bindings and allowlisted styles. Return explicit errors instead of silently falling back. Selection changes use viewRevision; design changes use draftRevision. Update visible editor state through the shared controller.

## Interfaces

Extend `src/workspace/contracts.ts` and implement edit handling in `src/workspace/designCommands.ts`. Require sessionId, projectId, targetId, expectedDraftRevision and operationId for batches, max 20 edits. Deduplicate by operation ID plus canonical input, checking prior receipts before stale-revision rejection on an identical retry. Conflicting operation-ID reuse fails. Return diff, changed layer IDs, new revision and a transaction token. Record before/after snapshots through a bounded history interface for A5; A5 owns the undo UI/tool, not a second mutation engine. Keep these mutation tools behind the development gate until A5 supplies visible activity, pause and undo.

## Validation

Test a mixed valid/invalid batch has zero effect, stale revisions preserve human edits, retries add only one layer, locked/unknown layers fail, hostile CSS URLs and unsupported bindings fail, and manual edits are reflected immediately in tool reads. Verify the canvas and saved/dirty status after a real tool call.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-12 — Accepted as complete after A5 supplied the production activity, pause, and safe-undo controls that were the remaining release condition. The typed mutation tools now register outside the development-only gate while retaining the A4 validation, revision, target, idempotency, dirty-state, and no-save/no-publish boundaries.

- 2026-09-12 — Implementation complete; moved to `in-review`. Added `catalog_forge_get_design`, `catalog_forge_set_view` and `catalog_forge_apply_design_changes` over the existing live editor state. The read tool returns a bounded active template. View changes select exact source IDs/layers or the existing canvas/all-sizes panel and use `viewRevision`. Draft batches require session, project, explicit master-or-placement target, current `draftRevision`, operation ID and 1–20 discriminated edits. They update the same React template state, revision reducer, canvas and dirty/save boundary as human edits; no tool saves or publishes.

- 2026-09-12 — `src/workspace/designCommands.ts` validates all input before commit and applies edits on a copy. The allowlist covers background, add/update/remove layer, content, geometry, visibility, object fit and supported style fields. It rejects unknown properties and IDs, locked-layer changes, duplicate IDs, non-finite or non-positive dimensions, unsupported bindings, HTML and CSS URLs/code. Successful results include field-level before/after differences, changed layer IDs, the applied revision, `persisted: false` and a transaction token. A bounded session history stores before/after templates and canonical receipts for A5; identical retries return the original receipt before stale-revision checks, while conflicting ID reuse fails.

- 2026-09-12 — Mutation tools remain development-only until A5 adds visible activity, pause and undo; `get_design` joins the production-safe read tools. Focused tests cover atomic mixed-batch failure, hostile input, lock and ID failures, bounded history, current design reads, exact view selection, stale view/draft revisions, idempotent add-layer retries, operation-ID conflicts, human interleaving, target switches and the production gate. A real Codex In-app Browser run selected the second fixture product, then atomically changed the canvas to dark green, updated the title and added one gold price badge. The editor visibly changed from Saved to Save changes, showed the unsaved warning and blocked publish. Retrying returned the same transaction token at revision 1 and the design still contained one badge. The fixture was removed and the normal local server restored. The full gate passed: 26 test files / 170 tests, typecheck, lint with zero warnings, and the production build with 98 static pages.
