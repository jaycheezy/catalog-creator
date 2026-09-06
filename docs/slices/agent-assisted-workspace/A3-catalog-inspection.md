---
id: "c-agent-catalog-inspection"
slice: "agent-assisted-workspace"
title: "A3 · Find products and explain feed issues"
step: "validate"
status: "proposed"
effort: "M"
order: 2
tags: []
dependsOn: ["c-agent-workspace-context"]
implementation: "specified"
value: "Lets an assistant quickly find products and explain catalog problems in plain words, so you know what to fix without hunting through rows."
---

# A3 · Find products and explain feed issues

## Summary

Expose query_products and get_validation against the saved full catalog so an agent can identify problems and representative products.

## Acceptance criteria

- Use stable source IDs and bounded pagination; support issue, sale and long-title queries without upstream refresh.
- Report the same full-snapshot findings as the shared validator, including a bad row after row 50 and unverified checks.
- Treat source content as data; distinguish source problems from design changes without changing product records.

## Scope

Own query_products and get_validation over the active saved snapshot. Do not refresh imports, change feed membership, mutate product fields or infer that a design edit fixes source data.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Read `src/lib/catalogValidation.ts`, `src/lib/facebook.ts`, `src/lib/renderProduct.ts`, and the controller contracts from A2. Implement pure bounded queries in a separate module such as `src/agent/catalogQueries.ts` and register them through the existing tool factory. Default page size is 20, maximum 50. Support exact source IDs, free text, issue code, sale status and title-length sorting with a stable ID tiebreaker. Return explicit unknown-ID errors. Match existing validation results rather than inventing a second validator.

## Interfaces

Inputs and common envelope follow the slice tool table. Cursors must be tied to the active snapshot and normalized query; reject a cursor reused against a different query/session. Return total matches, next cursor, stable source IDs and requested normalized fields. Validation totals cover the full snapshot; paginated affected IDs never alter the summary. Product descriptions remain untrusted data.

## Validation

Use fixtures for more than 50 rows with an invalid late row, two variants with the same handle, long titles, sales, incomplete imports and missing currency/image information. Verify pagination is stable, bounds are enforced, stale cursors fail, and queries leave the snapshot unchanged.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.
