---
id: "c-merchant-parity"
slice: "simplified-editor"
title: "Phase 1 parity proof and Phase 2 handoff"
step: "test"
status: "in-progress"
effort: "M"
order: 6
tags: []
dependsOn: ["c-merchant-shell", "c-merchant-nav", "c-merchant-layers", "c-merchant-canvas", "c-merchant-prompt-products", "c-merchant-inspector"]
implementation: "specified"
value: "Proves nothing you could do before was lost in the redesign, so you can trust the new look on real work."
---

# Phase 1 parity proof and Phase 2 handoff

## Summary

Verify Phase 1 completion: every capability from the old editor still accessible and functional in the redesigned workspace, then publish the what-changed / reuse / behavior-delta summary and the recommended Phase 2 order. Phase 2 implementation must not start until this passes.

## Acceptance criteria

- Checklist passes on desktop against a real project: selecting layers, adding layers, deleting/duplicating, visibility, ordering, locking, drag/resize on canvas, X/Y/W/H edits, image fit, radius, opacity/color, product change, aspect-ratio change, AI Generate, saving, JSON access, PNG export.
- Evidence shows the simplified ecommerce-editor look: rail + contextual panel, dominant canvas, prompt bar + legible product strip, grouped inspector, Export PNG primary.
- Handoff documents what changed, which existing components were reused, whether any behavior changed, and the recommended Phase 2 order.
- `npm run story-map:check`, tests, typecheck, lint, and build pass.

## Scope

Owns the parity test run, screenshot set, and handoff note. Excludes fixes (file them against the owning story) and any Phase 2 build.

## Implementation guidance

Exercise the UI manually plus existing automated coverage; do not invent new backend fixtures. Compare against pre-redesign behavior where in doubt. Record any deviation as a blocker implementation note under `docs/slices/simplified-editor/notes/` rather than silently adjusting scope.

## Interfaces

No interface changes. If the parity run reveals a contract drift introduced by Phase 1, the owning story must fix it; this story only verifies.

## Validation

- Execute each checklist item in order; capture before/after screenshots and save/JSON/export artifacts.
- Confirm no Templates/Uploads/My Designs/asset-library UI was added.
- Run the full check suite and record results.

## Completion handoff

Publish: parity table (criterion → pass + evidence), what changed vs reused (component list), behavior delta (must be "none" or linked blockers), and recommended Phase 2 order with effort/dependencies. Mark done only after review against every criterion.

## Progress

- 2026-09-13 — Automated evidence: `npm run story-map:check` (60 stories valid), `npm test` 29 files/188 pass, `npm run lint` clean, `tsc` clean for all editor files. Dev server compiles the editor route (`/editor` correctly gated behind `/login`). No Templates/Uploads/My Designs added; no new data models, backend, or editor behaviors — presentation refactor only.
- Remaining: manual browser checklist (login required; not exercisable headlessly) — selecting/adding/deleting/duplicating layers, visibility, ordering, locking, drag/resize, X/Y/W/H, fit, radius, opacity/color, product change, ratio change, AI Generate, save, JSON, PNG export — plus `npm run build`, currently blocked by the concurrent homepage syntax break (see notes/2026-09-13-homepage-syntax-blocks-build.md). Do not start Phase 2 until this clears.
- 2026-09-13 (design QA) — Headless visual + interaction QA passed against the mock (see notes/2026-09-13-editor-design-qa-mock.md): real render at 1600x1000 with 31 products and zero JS errors; rail tabs, Export PNG, Generate, size switch to 9:16, product 2/31 selection, and Price-Badge layer selection with inspector follow-through all verified. QA fixes (toolbar duplicate label, rail SVG icons, fixed-viewport shell) are presentation-only. Still open: hands-on items that mutate state (drag/resize, AI Generate, save, JSON import, PNG export bytes) plus `npm run build` after the homepage blocker clears.
- 2026-09-13 (verification agents) — Three parallel headless agents passed every non-mutating checklist item with zero console errors: zoom stepper, JSON download (`Gibun_Template_1.json`), all 4 size switches + All-sizes grid, rail switching with no draft change, add/select/hide/reorder/duplicate/delete layers, locked-drag no-op, all inspector groups and value edits, both AI keyword Generates, product switching 1/31→2/31→31/31 with bounds, JSON panel. Six implementation stories closed as done. One environmental FAIL (not a regression): headless PNG export hits foreignObject CORS on cross-origin product images and shows the designed "use Server PNG" fallback; export path is byte-identical to HEAD. PNG bytes, save/publish, and `next build` remain manual/open.
