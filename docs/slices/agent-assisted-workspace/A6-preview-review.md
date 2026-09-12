---
id: "c-agent-preview-review"
slice: "agent-assisted-workspace"
title: "A6 · Review products across placements"
step: "variants"
status: "done"
effort: "M"
order: 5
tags: []
dependsOn: ["c-agent-design-commands", "c-agent-visible-undo"]
implementation: "specified"
value: "Shows your design on real products across all sizes at once, so you can approve it with confidence before it goes live."
---

# A6 · Review products across placements

## Summary

Expose preview_design to show a bounded review grid using copies of the active draft, ready for human and agent visual inspection.

## Acceptance criteria

- Preview explicit products and sizes with no more than 12 total cells; identify the exact product, placement and draft revision.
- Exercise long titles, sale products and missing images; reject stale previews when the draft changes.
- Do not overwrite the active design, save variants or imply server PNG parity; visual review uses the browser output.

## Scope

Own preview_design and a transient review mode built on the existing all-sizes surface. Do not create a competing placement grid, save adapted templates, replace the active design, generate server variants or claim server render parity.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Reuse `src/editor/placementState.ts`, `src/editor/autoLayout.ts`, `src/editor/TemplateRenderer.tsx`, and the current all-sizes view in `src/app/editor/page.tsx`. Adapt immutable copies of the captured draft for each selected size. Extend that surface with a labeled review mode for explicit source product IDs and supported sizes, capped at 12 cells. Check the captured draft revision before showing results and honor A5's pause state because opening the review changes the visible workspace. Use actual product bindings so long-title and sale cases remain representative.

## Interfaces

Inputs: sessionId, projectId, expectedDraftRevision, productIds and sizeIds. The product/size Cartesian product must contain at most 12 cells. Result: viewId, captured draft revision, each source ID/size/dimensions, and warnings. Unsupported sizes, missing IDs and oversized requests fail before opening a partial grid. Expose enough view information for browser screenshots; do not return large base64 images or treat a metadata result as visual approval.

## Validation

Test bounded combinations, invalid sizes/IDs, draft changes during work and source immutability. Verify a long title, sale product and missing image visually in square and Story layouts. Confirm active template, selection semantics and saved fingerprints remain correct after opening and closing the grid.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

## Progress

- 2026-09-12 — Review accepted through A7's real workflow proof; moved to `done`. The independent 60-row browser fixture exercised the same review surface with the longest title, the on-sale product, and the missing-image product across 1:1 and 9:16. The tool returned six exact cells at captured draft revision 1, the visible grid stayed labeled preview-only, and the subsequent human edit cleared the captured review before stale recovery and save.

- 2026-09-12 — Implementation complete; moved to `in-review`. Registered `catalog_forge_preview_design` with the existing workspace provider. The command requires the current session/project and `expectedDraftRevision`, explicit unique source product IDs, and supported size IDs. It rejects unknown fields, duplicate values, missing products, unsupported sizes, paused mutations, stale drafts, cancellation, and Cartesian products above 12 cells before changing the UI. The result reports one `viewId`, captured draft revision and target, exact source ID/size/dimensions for each cell, `surface: browser-draft`, `persisted: false`, and an explicit visual-review/no-PNG-parity warning.

- 2026-09-12 — Added a transient review state and `AgentReviewGrid` within the existing all-sizes editor surface. It clones the captured active draft, adapts a fresh clone per requested size through `adaptTemplateToSize`, and renders real product bindings through `TemplateRenderer`. Cards identify the product title, stable source ID, placement, dimensions, and sale price where present. The grid uses two columns at desktop widths after the first visual pass found that three columns let scaled canvases overlap between the existing editor sidebars. Review cards expose no save, PNG, placement-edit, or reset actions.

- 2026-09-12 — Opening and closing the review increments only the view revision and keeps the active target, active template, selected product/layer, saved project/template revisions, content fingerprint, and dirty state intact. Close returns to the ordinary all-sizes view. Any subsequent human or agent draft edit clears the captured review so an old snapshot cannot remain presented as current. Execution also rechecks the draft and pause state immediately before opening the review.

- 2026-09-12 — Unit and markup tests cover the 12-cell boundary, duplicate/invalid sizes and IDs, missing source IDs, a draft change while authorization is pending, pause, no partial commit, cloned-source immutability, unchanged selection/save state, exact cell metadata, and long-title/sale/missing-image rendering in square and Story. Real Codex In-app Browser verification discovered all eight tools and opened six cells for `fixture:long-title`, `fixture:sale`, and `fixture:missing-image` across 1:1 and 9:16. The visible output showed the long title, `25% OFF`, and `No image — MISSING-IMAGE`; context before/open/close stayed at draft revision 0 with the same selection and saved status while view revision advanced 0 → 1 → 2. Full gate passed: 28 test files / 182 tests, typecheck, lint with zero warnings, and the production build with 99 generated pages.

### Notes

- This review is deliberately session-local and browser-only. It does not persist review IDs, save adapted placements, create render assets, or establish server PNG parity.
- Product and size order follows the caller's explicit arrays. Duplicate values are rejected rather than silently collapsed, which keeps the requested cell count and result metadata unambiguous.
- The visual fixture also made the existing static-binding limit clear: a layer such as `{{discount_pct}}% OFF` renders `% OFF` for products without a sale because conditional layer visibility is not part of the current design model. The review reports what the template really renders; conditional badges remain a separate product capability.
