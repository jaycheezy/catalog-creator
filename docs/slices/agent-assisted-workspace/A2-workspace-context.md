---
id: "c-agent-workspace-context"
slice: "agent-assisted-workspace"
title: "A2 · Share the active workspace with an agent"
step: "connect"
status: "done"
effort: "L"
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

- Return active project, catalog completeness, master/placement target, selections, draft/saved revisions, publication summary and supported capabilities without dumping the catalog or credentials.
- UI and tools use the same controller and current state; stale session/project references fail explicitly.
- Registration follows the eligible editor session, cleans up on teardown/logout, isolates tabs, and leaves unsupported browsers usable.

## Scope

Own the live workspace read model, shared contracts, provider lifecycle, WebMCP adapter and get_context. Introduce controller transitions incrementally where later UI and tools need one mutation path. The active project editor is the integration point. Exclude product search, draft batch edits, undo UI, and preview grids.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read `src/app/editor/page.tsx`, `src/editor/saveState.ts`, `src/editor/placementState.ts`, `src/editor/publicationState.ts`, `src/lib/catalogProject.ts`, and the A1 report. Implement in two checkpoints: first the bounded live read model plus production registration lifecycle and get_context; then the minimum shared command/revision boundary A3–A6 require. Avoid moving save/publish networking into a general state machine. Route design mutations through the same revision path as that boundary is introduced, including resize, layer controls, the legacy AI actions and JSON import. Keep master and placement lineage, loading, errors, saved fingerprints, and publication state accurate. Attach the provider only to a loaded project. The adapter must use A1’s verified lifecycle API and clean up without leaking tools across sessions.

## Interfaces

Own `src/workspace/controller.ts`, `src/workspace/contracts.ts`, `src/agent/webmcp.ts`, `src/agent/tools.ts`, and `src/components/AgentWorkspaceProvider.tsx`. Expose a synchronous current-state read and a typed command boundary; add a subscription only when a consumer needs it. Define session/project identity, session-wide draftRevision, viewRevision, `targetId` (`master` or `placement:<sizeId>`), saved project/template/placement revisions, actor, dirty state and result/error envelopes as specified in the slice. Publish the extension points A3–A6 will use. get_context must remain bounded and exclude product rows, source secrets, catalog dumps and capability feed URLs.

## Validation

Test current-state reads after manual changes, session replacement, mount/unmount, logout, loading failures, and two independent controller instances. Preserve existing manual save/reload regressions. Verify a browser lacking WebMCP can still edit and save. An adapter mock does not substitute for A1’s real browser evidence.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-12 — Review accepted through continuation into A3; moved to `done`. A3 reused the published current-state reader, same-origin authorization check, session/project identity guard, result envelope and registration lifecycle without widening A2's controller into catalog or persistence concerns.

- 2026-09-11 — Second checkpoint complete; moved to `in-review`. Added the shared `workspaceRevisionReducer` and typed command identity guard instead of a general editor state machine. Manual layer/template/resize, legacy AI and JSON-import changes now share one draft revision path; selection, product and all-sizes changes share the view revision path; project loads reset both without changing durable revisions. Session, project, target and expected-draft mismatches return explicit bounded failures. The provider now publishes the latest committed React context, requires the loaded aggregate ID to match the URL project, rechecks same-origin authorization at tool execution and window focus, and removes its registration after authorization loss or teardown.

- 2026-09-11 — Real Codex In-app Browser verification used an isolated local project. The production `catalog_forge_get_context` tool was discovered and returned the loaded project, validation, placement lineage, selection, saved/publication state and capabilities without the fixture source URL or product row. A visible human “dark premium” edit changed the canvas, advanced `draftRevision` from 0 to 1, set dirty/unsaved state, and was present through the same existing tool handle. Navigation to Story Map removed the tool and made the old handle stale; reload issued a new session and invalidated the old handle; two open editor tabs had different session IDs, and changing one to all-sizes advanced only that tab’s `viewRevision`. A separate password-protected run invalidated the active session, redirected the editor to Sign in, and left no WebMCP tools registered. The fixture and browser tabs were removed after testing.

- 2026-09-11 — Focused workspace/WebMCP tests cover 11 cases, including current-state execution, bounded source data, cancellation, auth loss/auth-check failure, unsupported browsers, independent revision state and stale session/target/revision rejection. The full repository gate passed: 24 test files / 159 tests, typecheck and lint with zero warnings. The production build passed with 98 static pages.

- 2026-09-11 — First implementation checkpoint complete. Added shared workspace/result contracts, a generic WebMCP registration lifecycle reused by the A1 probe, the read-only `catalog_forge_get_context` definition, and an editor-mounted provider for loaded projects. The live result reports bounded project/import/validation, master and placement state, draft/view and saved revisions, selection, publication summary, busy state, and only the currently available tool. Source URLs, product rows, credentials, and feed links are excluded. Existing editor mutation paths now advance session draft/view revisions, while save confirmations retain their separate durable revisions. Focused WebMCP/workspace tests pass (2 files / 8 tests), typecheck and lint pass without warnings. The story stays `in-progress`: the remaining checkpoint is the minimum shared controller/command boundary plus real lifecycle verification of the production tool.

- 2026-09-11 — Scope refreshed after Reliable Catalog and Netlify completion. A2 stays one story with two reviewable checkpoints and is re-estimated as `L`: bounded context/registration first, then only the shared revision transitions later tools require. Placement-aware targets, production gating for mutation tools, existing all-sizes reuse, and the human Save boundary are now explicit. Implementation started with the contracts and read-only context path.
