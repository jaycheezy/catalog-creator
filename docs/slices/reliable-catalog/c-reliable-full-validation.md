---
id: "c-reliable-full-validation"
slice: "reliable-catalog"
title: "Validate the entire catalog with shared rules"
step: "validate"
status: "done"
effort: "M"
order: 9
tags: ["next"]
dependsOn: ["c-reliable-catalog-project", "c-reliable-feed-import"]
implementation: "specified"
value: "Checks every product once with clear guidance by name, so you fix real issues faster and avoid rejected ads."
---

# Validate the entire catalog with shared rules

## Summary

Replace the first-50-row verdict with one validation result used by preview, the auditor, and publication. Report problems by product ID.

## Acceptance criteria

- An invalid product after row 50 is included in error counts and prevents a ready verdict.
- Detect duplicate or missing IDs, missing required fields, invalid links, non-finite prices, and invalid currencies or sale prices.
- CSV uploads use the same rules; incomplete imports and unverified image checks cannot be presented as fully validated.

## Scope

Own deterministic validation of normalized `FeedRow[]`, grouped issue/result types, status derivation, and reuse of the same result across UI and routes. Include identity, required content, HTTP links, availability/condition, regular/sale price syntax and relationship, completeness, and image-check state. Exclude automatic source fixes, remote image dimension fetching, Meta API validation, and merchant-specific policy.

## Progress

Implemented: one grouped validation result now covers every saved row and is reused by store/feed previews, the auditor, saved projects, and feed response headers. It reports affected product IDs for required fields, duplicate identities, links, ISO prices, sale prices, completeness, stock, and unverified image checks.

## Implementation guidance

Keep rules in `src/lib/catalogValidation.ts`; callers must not recreate partial verdicts. Validate the entire saved array before slicing preview rows. Each rule gathers zero-based `rowIndexes` and corresponding merchant-facing product IDs. Count affected rows consistently and use stable `code` values so the auditor and future agent tools can filter findings.

Parse prices only in canonical positive `0.00 ISO` form and use runtime-supported ISO currency values with the maintained fallback set. Sale prices must parse, match regular currency, and be lower than the regular price. `importComplete: false` is blocking. `imageChecks: "not-run"` is a warning for every nonempty catalog and prevents `ready`; it must never imply broken URLs were checked.

## Interfaces

`validateCatalog(rows, { importComplete?, imageChecks? })` returns `CatalogValidationResult`: status, row/error/warning/info counts, currencies, completeness, image-check state, and `CatalogValidationIssue[]`. Status is `blocked` for any error, `needs-review` for warnings without errors, otherwise `ready`.

Preview/project JSON includes this result. The validator renders it. Project feed responses expose summary headers `X-Catalog-Validation`, `X-Catalog-Errors`, and `X-Catalog-Warnings`. The publication story must call the same function/result and block errors rather than trusting a stale UI label.

## Validation

`tests/catalogValidation.test.ts` covers supported non-EUR sale prices, a blocking row beyond the preview window, duplicates, currency mismatch, incomplete import, and unverified images. `tests/previewValidation.test.ts` proves preview truncation does not truncate validation. `tests/projects.test.ts` proves late CSV findings persist. Add route assertions whenever a new consumer is introduced.

Run `npm test`, `npm run typecheck`, and `npm run build`. Browser evidence should show counts and affected IDs matching the same project response and feed headers.

## Completion handoff

Reviewers should map each acceptance criterion to unit and route evidence, confirm callers do not validate only displayed rows, and report any new rule code or status-policy change. Future image verification must extend `imageChecks` explicitly and add evidence rather than silently removing the current warning.
