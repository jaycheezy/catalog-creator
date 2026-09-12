---
id: "c-agent-catalog-inspection"
slice: "agent-assisted-workspace"
title: "A3 · Find products and explain feed issues"
step: "validate"
status: "done"
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

## Progress

- 2026-09-12 — Review accepted through continuation into A4; moved to `done`. A4 consumes the same current catalog snapshot for stable product selection and leaves product records, validation and upstream sources unchanged.

- 2026-09-12 — Implementation complete; moved to `in-review`. Added pure read-only catalog queries over the editor's loaded saved `FeedRow[]` snapshot and existing `CatalogValidationResult`. `catalog_forge_query_products` supports exact source IDs, free text, issue code, sale status, title-length ordering with a stable source-ID tie break, requested field projection, default pages of 20 and a maximum of 50. `catalog_forge_get_validation` always returns the full saved-snapshot summary while paging either grouped findings or affected source references. No new catalog model, upstream refresh, product mutation or design-to-source repair inference was introduced.

- 2026-09-12 — Inputs are checked at runtime against the advertised allowlist. Product content is bounded and marked as untrusted source data. Unknown source IDs and issue codes fail explicitly. Opaque cursors are bound to mode, session, project, saved project revision and normalized query, so reuse after a query, session or snapshot change fails instead of silently paging a different result. Incomplete import and unverified image checks remain explicit; issue remediation is identified as source data.

- 2026-09-12 — Focused fixtures cover 60 products, two variants with one product handle, equal-length long titles, a sale, incomplete import, missing image data and an invalid price at row 56. Unit/integration coverage verifies stable paging, bounds, field projection, late-row lookup, stale cursors, validation totals, affected-ID paging, immutability and all three read-only WebMCP registrations. Real Codex In-app Browser verification discovered the production tools in a loaded project, found the row-56 price failure, paged all 60 unverified-image references as 50 + 10 without changing summary totals, found the one sale, used stable long-title ordering and rejected a cursor reused with another query. The disposable fixture was removed and the normal local server restored. The full gate passed: 25 test files / 165 tests, typecheck, lint with zero warnings, and the production build with 98 static pages.
