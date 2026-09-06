---
id: "c-agent-visible-undo"
slice: "agent-assisted-workspace"
title: "A5 · See and undo agent changes"
step: "design"
status: "proposed"
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
