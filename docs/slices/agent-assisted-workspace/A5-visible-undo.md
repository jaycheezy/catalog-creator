---
id: "c-agent-visible-undo"
slice: "agent-assisted-workspace"
title: "A5 · See and undo agent changes"
step: "design"
status: "done"
effort: "M"
order: 4
tags: []
dependsOn: ["c-agent-design-commands"]
implementation: "specified"
value: "Shows what the assistant changed and lets you undo it in one click, so it's safe to try help without fear of breaking your design."
---

# A5 · See and undo agent changes

## Summary

Add local activity, changed-layer feedback, a pause control and undo_design_change so human and agent edits can safely interleave.

## Acceptance criteria

- Show one activity entry and undo point per draft transaction without prompting for every layer edit.
- Human edits invalidate stale agent edits and unsafe undo; pause prevents subsequent tool mutations.
- Keep draft and saved revisions distinct and retain the existing human Save action; availability does not falsely imply an agent is connected.

## Scope

Own agent activity, changed-layer feedback, pause controls and undo_design_change. History is local to this session. Do not introduce durable audit storage or a new save/publish flow.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Build on A4’s transaction receipts and A2’s state. Show one concise activity entry for each committed agent transaction, an Undo control and a pause toggle. Tools must check pause at execution time, not only during registration. Undo restores only the immediately preceding matching transaction and increments the draft revision. Reject a request after intervening human edits or a project switch. Cap history at 50 transactions and release older snapshots. Ordinary draft edits do not need per-layer confirmation dialogs.

## Interfaces

Implement `src/components/AgentActivity.tsx` and register the undo tool through the existing factory. Require session/project identity, expectedDraftRevision and undoToken. Store actor, operation ID, changed IDs, before/after revision and result in activity. Expose availability and pause state in get_context; do not claim agent connection based on registration. Preserve human Save and distinguish saved revisions from draft revisions.

## Validation

Test agent edit → undo, human edit → unsafe undo rejection, pause with a queued mutation, session teardown, history expiry, and save completion while newer edits exist. Browser verification should demonstrate visible activity, changed layers, keyboard-accessible controls and correct dirty status.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-12 — Review accepted by continuation into A6; moved to `done`. A6's real-browser preview run reused A5's execution-time pause boundary and preserved activity/undo behavior, with all 28 test files / 182 tests, typecheck, zero-warning lint, and production build still green.

- 2026-09-12 — Implementation complete; moved to `in-review`. Added the compact `AgentActivity` panel to the eligible project editor. It reports actual WebMCP tool availability without claiming an agent connection, exposes a native keyboard-operable pause control, keeps the five most recent entries visible, offers one safe Undo for the latest eligible transaction, and reminds the merchant that the existing Save action remains the persistence boundary. Each agent design batch records actor, operation and transaction IDs, target, changed layer IDs, before/after draft revisions, timestamp, and the full bounded result. Changed layers are highlighted in the existing Layers panel until a human draft edit or undo clears the feedback.

- 2026-09-12 — Registered `catalog_forge_undo_design_change` and released the A4 mutation tools from their development-only gate. Undo requires session/project identity, current `expectedDraftRevision`, and the latest transaction token. It restores the prior design through the same live React state and revision reducer, increments the draft revision, preserves current durable revision metadata, and rejects tokens after a human edit, target/project change, expiry, or an earlier undo. A successful undo clears the obsolete receipt/snapshot branch. Save status continues to use the existing content fingerprint, so restoring the exact persisted design correctly returns the editor to `Saved ✓`; completing an older in-flight save cannot mark newer edits saved.

- 2026-09-12 — Pause is read at execution time after asynchronous session authorization and immediately before every agent view/design mutation. Reads remain available, identical apply retries can still return their prior receipt without another mutation, and the editor's human Undo remains available while agent edits are paused. History and operation receipts are session-local, capped at 50, cleared on provider teardown, and never persisted.

- 2026-09-12 — Focused tests cover edit → activity → undo, save metadata before safe undo, human edit → `UNDO_CONFLICT`, changed project rejection, queued mutation pause, view pause, the 50-entry expiry/teardown limit, accessible activity markup, changed-layer labeling, and an older save completing after a newer draft edit. Real Codex In-app Browser verification discovered all seven tools and confirmed context availability/pause/activity/undo state. A two-edit batch produced one visible activity row, highlighted the title, made the design unsaved, and blocked publication. Keyboard pause rejected a subsequent batch without changing the revision. Keyboard Undo restored the saved background/title and advanced draft revision. A second agent edit followed by a manual color edit disabled Undo, cleared the highlight, and returned `UNDO_CONFLICT` while preserving the human color. Full gate passed: 27 test files / 178 tests, typecheck, lint with zero warnings, and production build with 98 static pages.

### Notes

- Undo is intentionally conservative: only the immediately preceding unchanged agent transaction is eligible. After undo, older receipts and snapshots are released instead of implementing a multi-level timeline.
- Activity is local to the open editor session and retains at most 50 transaction records; the panel displays the five most recent. Durable audit history and agent-driven save or publication remain outside this slice.
