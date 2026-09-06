---
id: "c-agent-workflow-proof"
slice: "agent-assisted-workspace"
title: "A7 · Prove a real agent-assisted session"
step: "test"
status: "proposed"
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

- Record real browser/tool evidence, including manual interleaving, stale revisions, duplicate calls, cancellation, logout and two-tab isolation.
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

Run `npm test`, `npm run typecheck`, and `npm run build`; add targeted integration regressions for actual defects. Exercise unknown IDs, malformed batches, retry/cancellation, logout, navigation, two tabs, paused edits and unavailable WebMCP. Verify no tools persist changes, modify source products or publish to Meta. Do not mark the slice done based solely on mocked tools.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.
