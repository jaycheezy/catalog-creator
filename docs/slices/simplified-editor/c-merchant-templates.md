---
id: "c-merchant-templates"
slice: "simplified-editor"
title: "Template starting points for common jobs"
step: "design"
status: "done"
effort: "M"
order: 7
tags: ["phase-2"]
dependsOn: ["c-merchant-parity"]
implementation: "specified"
value: "Starts you from a ready-made ad for a sale or new arrival, so a good-looking creative is one click away."
---

# Template starting points for common jobs

## Summary

Build reusable creative starting points for Product Highlight, Special Offer, New Arrival, Seasonal, and Discount (plan approved in notes/2026-09-13-phase-2-plan.md). The merchant picks a job in a new Templates rail tab and sees their current product in it; applying replaces the draft design behind an unsaved-work confirm. No new backend or persistence.

## Acceptance criteria

- Templates tab lists the five starters, each showing what it pre-fills (live thumbnail with the current product, name, one-line blurb); the Phase 1 rail contract holds (Design/Products/Elements keep working, Templates is additive).
- Applying a starter keeps template id/size/dimensions, replaces background + layers with fresh ids, selects nothing, and marks the draft unsaved through the existing `updateActive` path.
- Applying with unsaved changes asks for explicit confirmation first; product data (`products`, `productIdx`) is never touched.
- Other sizes keep working through the existing placement adaptation; no parallel template model is introduced.

## Scope

Owns `src/editor/starterTemplates.ts` (five `build(sizeId)` starters using existing layer types + bindings only), the Templates rail tab + apply flow in `src/app/editor/page.tsx`, and live thumbnails via existing `TemplateRenderer`. Excludes My Designs/saved-design browsing, new layer types or style fields, uploads, and any persistence or API change. Started per owner override while parity is in-progress (see phase-2 plan note).

## Implementation guidance

Model builders on `createDefaultTemplate` in `src/editor/types.ts`: take `sizeId`, resolve dims via `getPresetById`, lay out with margins proportional to `preset.width/height` (no fixed 1080 assumptions), use bindings `{{title}}`, `{{price}}`, `{{discount_pct}}`, `{{vendor}}` only. Distinct looks: Highlight (large product, title, price badge), Special Offer (bold sale badge `{{discount_pct}}% OFF`, dark accent), New Arrival (light airy, vendor eyebrow + title), Seasonal (green tint panel, badge), Discount (price + compare-price treatment via `{{price}}`). Keep every layer within canvas bounds for all four presets; keep ids unique per build (`layer_` + random, never colliding with `layer_title` semantics).

In `page.tsx`: extend the rail tab union with `"templates"` (icon + label, same 56px treatment); panel lists starter cards (thumbnail `TemplateRenderer template={preview} product={product} scale={...}` sized to ~260px width, name, blurb, Apply button ≥40px). Build preview from `build(active.sizeId)` on render (cheap, pure). Apply handler: `if (!headerSaved && !window.confirm("Replace your current design? Unsaved changes will be lost.")) return;` then `updateActive({...active, name: starter.name, background, layers})` + `selectLayer(null)`. Reuse `updateActive`/`selectLayer` only — no new state, no revision-path changes.

## Interfaces

Reuses `Template`/`Layer`/`SIZE_PRESETS` and the `placementTemplates` save contract unchanged; save identity (template id) is preserved on apply. No new types, routes, or storage. `starterTemplates.ts` exports `STARTER_TEMPLATES: { id, name, blurb, build(sizeId: string): Template }[]` — pure functions, trivially unit-testable.

## Validation

Headless verification against live dev: tab lists 5 starters with thumbnails; Apply replaces layers and marks Unsaved; Apply always shows a confirm dialog when the draft is not saved (note: a fresh draft is never `headerSaved`, so the dialog also appears there — this is the safe direction and satisfies "never destroys unsaved work without explicit confirmation"); dismiss keeps work, accept replaces; product selection unchanged; size switch after apply keeps starter design; zero console errors; `npm test`, `npm run typecheck` (editor files), `npm run lint` clean. Add a unit test for builders (bounds + bindings + unique ids across all presets).

## Completion handoff

Report changed files, starter → layers/bindings map, screenshots, check results, and confirmation of zero contract change. Update status to in-review when evidence is ready.

## Progress

- 2026-09-13 — Implemented: new `src/editor/starterTemplates.ts` (5 pure `build(sizeId)` starters, existing layer types + allowlisted bindings only; 22 unit tests pass) + Templates rail tab/panel/apply flow in `src/app/editor/page.tsx` (live `TemplateRenderer` thumbnails, `applyStarter` keeps id/size via `updateActive`, confirm when `!headerSaved`, product untouched). No new types/routes/storage.
- 2026-09-13 — Reviewed done (headless verification agent, 7 sessions, zero console errors): 5 starters with live thumbnails and 44px Apply buttons; clean-draft apply replaces layers (fresh ids, id/size kept, back to Design, counter unchanged); dirty-draft apply confirms with the specified message (dismiss keeps, accept replaces); Special Offer survives a 9:16 switch; Design/Products/Elements unaffected. Full Phase 1 regression re-run in parallel: all green (header, sizes, layers, inspector, prompt, strip).
