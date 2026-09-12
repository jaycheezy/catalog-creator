---
id: "c-agent-workflow-proof"
slice: "agent-assisted-workspace"
title: "A7 · Prove a real agent-assisted session"
step: "test"
status: "done"
effort: "M"
order: 6
tags: []
dependsOn: ["c-agent-catalog-inspection","c-agent-visible-undo","c-agent-preview-review"]
implementation: "specified"
value: "Proves the whole helper journey works in real life, so you can trust an assistant to help from checking products to saving safely."
---

# A7 · Prove a real agent-assisted session

## Summary

Demonstrate inspect → explain → edit → preview → human tweak → recovery → undo → human save with Codex and the app open together.

## Acceptance criteria

- Record real browser/tool evidence, including manual interleaving, stale revisions, duplicate calls, cancellation, authentication loss/logout cleanup and two-tab isolation.
- Confirm the human-saved design survives reload and normal editing works without WebMCP.
- Pass focused command/lifecycle checks and existing regression, typecheck and build gates; no source edits or Meta publication occur through these tools.

## Scope

Own end-to-end verification and evidence for the completed slice. Fix integration defects within the existing contracts. Do not expand functionality to source edits, remote MCP, renderer parity or agent publication.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read A1’s compatibility report and the completed A2–A6 handoffs. Prepare a non-demo fixture project with variant IDs, more than 50 rows, long titles, sale pricing and missing images. Run the example prompt in the slice spec through the actual agent/browser path. Deliberately interleave a human edit, recover from a revision conflict and exercise undo. Use the existing human Save and reload the project. Document any setup required for reproducing the run.

## Interfaces

Write evidence to `docs/research/agent-workspace-verification.md`: environment versions, fixture identity, acceptance-to-evidence table, concise tool results, screenshot paths and unresolved limitations. Redact private source text. Tool receipt schema and public contracts remain owned by the earlier stories; coordinate any required change explicitly.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run build`; add targeted integration regressions for actual defects. Exercise unknown IDs, malformed batches, retry/cancellation, authentication loss/logout cleanup, navigation, two tabs, paused edits and unavailable WebMCP. Verify no tools persist changes, modify source products or publish to Meta. Do not mark the slice done based solely on mocked tools.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Move the story through review only when real-browser evidence and the full repository gate pass. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-12 — Completed the real Codex In-app Browser workflow against two disposable, password-protected local projects with 60 stable source rows each. The primary session inspected the longest title, the on-sale row and the missing-image row; full-snapshot validation found the intentionally malformed price at row 56, beyond the 50-row query maximum. An unknown product ID, unsupported CSS and an unexpected batch property all returned bounded failures and left draft/view revision 0 unchanged.

- 2026-09-12 — Pause blocked a prepared mutation without advancing the draft. One atomic operation made the title heavier and the price badge dark green, returned draft revision 1 and one undo token, and an identical retry returned that original receipt rather than applying twice. `catalog_forge_preview_design` then opened six labeled browser-draft cells for the three representative products across 1:1 and 9:16. [The saved review screenshot](../../research/evidence/agent-workspace/a7-review-grid.jpg) records the visible result.

- 2026-09-12 — A human changed the title color in the normal Properties panel, advancing the draft to revision 2 and invalidating the earlier undo point. The prepared revision-1 operation returned `REVISION_CONFLICT` and preserved that color. After refreshing context, a background change applied at revision 3; undo restored the prior white background at revision 4 while retaining the human title color and the earlier green price badge. The human Save action advanced only the durable project/template revision to 2. [The saved-state screenshot](../../research/evidence/agent-workspace/a7-human-saved.jpg) shows the final editor and visible activity.

- 2026-09-12 — Reload created a fresh session with draft/view revision 0, no activity, `dirty: false`, and the saved blue title/green price design intact. The 60 source rows and row-56 invalid price remained unchanged, and publication stayed `not-published` with no publication record. A second IAB tab received a different session ID and project, kept its own blue background and product selection, and rejected the first tab's identity with `SESSION_CHANGED`; navigation to Story Map removed all page tools and made its old handle stale.

- 2026-09-12 — Chrome 152 advertised no WebMCP capability, displayed `Unavailable in this browser`, and still completed a normal human color edit, Save, and settled reload with the saved value intact. [The fallback screenshot](../../research/evidence/agent-workspace/a7-chrome-fallback.jpg) records that state. The browser caller cancellation test timed out a 50-row query, after which context reconciliation showed the draft and view unchanged; focused tests retain the structured `CANCELLED` pre-commit coverage. Authentication-loss cleanup is covered by A2's real password-protected browser run plus the execution-time `AUTH_REQUIRED` and registration-abort tests; the app has no visible logout control, so this story treats logout and equivalent credential loss as the same tool-lifecycle boundary instead of adding a new account UI.

- 2026-09-12 — Evidence and reproduction details are recorded in [the verification report](../../research/agent-workspace-verification.md). No public tool schema changed during A7 and no new runtime feature was needed. The disposable projects, local store records, and temporary browser tabs were removed after the run.

- 2026-09-12 — Full closure gate passed after the story-map updates: 28 test files / 182 tests, typecheck, lint with zero warnings, and the production build with 99 generated pages. A6 and A7 are `done`; the Agent-assisted workspace slice is complete.
