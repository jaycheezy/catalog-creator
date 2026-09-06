---
id: "c-agent-browser-spike"
slice: "agent-assisted-workspace"
title: "A1 · Prove the Codex browser connection"
step: "connect"
status: "done"
effort: "S"
order: 0
tags: []
dependsOn: []
implementation: "specified"
value: "Confirms an assistant can safely help inside your open catalog before we build more automation, so you don't pay for tools that don't work in your browser."
---

# A1 · Prove the Codex browser connection

## Summary

Timebox WebMCP compatibility before building the toolset. Verify the intended agent can discover and call tools in the open Catalog Forge tab.

## Acceptance criteria

- Record a real context query and reversible visible action from the intended Codex/browser combination; an inspector-only demo is insufficient.
- Document runtime versions, setup, registration/cleanup API, reload and navigation behavior, and unsupported-browser fallback.
- Timebox to about one engineering day; estimate a bridge separately if required.

## Scope

Prove page-tool discovery and execution from the intended external agent. Own only a temporary development probe, its cleanup, and a compatibility report. Do not install a custom relay, build the production toolset, or modify credentials.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Inspect the authenticated editor route and the actual browser integration first. Use the current primary WebMCP documentation linked in the slice spec; verify the runtime instead of assuming the newest draft is implemented. Register a compact context query and one reversible background-color action against a fixture project. Restore the original draft after the probe. Exercise navigation, refresh, logout, two tabs, and an unsupported runtime. Remove the probe from normal production behavior.

## Interfaces

Produce `docs/research/webmcp-compatibility.md` as a supporting document outside the story directory. Record the chosen client/browser versions, entry point, registration/cleanup signatures, return encoding, available cancellation behavior and required setup. A2 must consume this evidence. The probe must not expose cookies, arbitrary JavaScript, or persisted save operations.

## Validation

Capture one actual tool discovery, one context result, and one visible reversible change from the external agent. An inspector-only call is insufficient. Record unsupported behavior honestly. If the intended path fails within one day, stop the spike and report the blocker and a separately estimated bridge option; do not claim the prerequisite is complete.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-05 — Read repository instructions, the slice architecture, this story, and all current slice notes. No pre-existing open blocker applied to starting the compatibility spike.
- 2026-09-05 — Verified the current WebMCP guidance: Chromium early preview, `document.modelContext.registerTool(tool, { signal })`, and `AbortController.abort()` cleanup; `navigator.modelContext` is retained only as a compatibility fallback.
- 2026-09-05 — Implemented a development-only query-gated probe and unit-tested its registration, return envelope, validation and abort cleanup. Real Codex/browser discovery and invocation evidence is still pending before moving this story to `in-review`.
- 2026-09-05 — Real run: the logged-in Chrome fixture editor reported `Registration: unsupported`; the Codex In-app Browser exposed `webmcp` but `fetchTools()` failed with `gpt-5.6-luna does not support command "webmcp_list_tools"`. Reload and navigation cleanup behavior was observed; no context/action result was claimed.
- 2026-09-05 — Full `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` passed (lint retains seven pre-existing warnings). Compatibility report: [`docs/research/webmcp-compatibility.md`](../../research/webmcp-compatibility.md). Cross-story blocker: [`2026-09-05-luna-webmcp-blocker.md`](notes/2026-09-05-luna-webmcp-blocker.md).
- 2026-09-06 — Fixed the development Strict Mode registration race by deferring probe registration past the discarded effect mount. In a Terra-backed Codex In-app Browser, discovery returned both tools; `catalog_forge_spike_get_context` returned the bounded live context; `catalog_forge_spike_set_background` visibly changed `#ffffff` to `#0f5132` and restored `#ffffff` with `persisted: false`. Reload re-registered both tools, navigation to Story Map removed them, and a second editor tab registered independently. `npm run check` passed (15 files, 84 tests). The Luna blocker is resolved by [`2026-09-06-terra-webmcp-decision.md`](notes/2026-09-06-terra-webmcp-decision.md). User-authorized acceptance review completed; status set to `done`.
