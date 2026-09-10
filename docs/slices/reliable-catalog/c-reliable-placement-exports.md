---
id: "c-reliable-placement-exports"
slice: "reliable-catalog"
title: "Export the selected placement revision"
step: "variants"
status: "done"
effort: "M"
order: 14
tags: ["next"]
dependsOn: ["c-reliable-durable-saves", "c-reliable-render-parity", "c-reliable-variant-render"]
implementation: "specified"
value: "Gives each ad size its own correct preview and file, so every placement on phones and feeds looks right."
---

# Export the selected placement revision

## Summary

Each size preview must link to its own saved variant. Current all-sizes PNG links reuse the active template ID.

## Acceptance criteria

- Save all variants retains the returned IDs and reports partial failures accurately.
- Each PNG link returns the intended 1:1, 4:5, 9:16, or 1.91:1 dimensions and design revision.
- Shopify and WooCommerce exports resolve the selected product without relying on a Shopify-only URL path.
- A saved custom placement reopens from its own snapshot with a fresh PNG link and saved header state; Reset to master opens a reviewable dirty draft.
- Switching the master size cannot leave a card preview/draft out of sync with the variant that save-all persists.

## Scope

Own durable project placement-template state, save-one/save-all API orchestration, per-placement saved/dirty UI state, saved manual customizations and reset-to-master behavior, and the four preview/export links. Cover `1:1`, `4:5`, `9:16`, and `1.91:1`. Exclude R2 PNG caching/versioned asset URLs, publication, and new placement sizes.

## Implementation guidance

Read [the placement contract](index.md), `src/editor/types.ts`, `src/editor/autoLayout.ts`, `src/editor/saveState.ts`, `src/lib/catalogProject.ts`, the project API, and the all-sizes section of `src/app/editor/page.tsx`. Introduce an exported `SizePresetId` union and a project `placementTemplates` record keyed by preset ID. Each value is a complete saved `Template` snapshot with unique template ID, dimensions, and revision. Migrate old projects by treating `project.template.sizeId` as their only saved placement.

For project-backed save-all, adapt copies from the captured active draft, assign/preserve IDs per placement, validate all variants, and update the project aggregate once with `expectedRevision`. If validation fails before the write, save none. If the durable project write fails, retain all drafts and prior saved records and show a retryable aggregate error. Standalone legacy mode may continue separate template POSTs but must retain each response and report the exact successes/failures.

Track saved fingerprints per placement/template. The preview card's PNG link uses that card's saved template, dimensions, and the current product `source_id`; hide or label the link stale after its draft changes. Do not reuse one `productRenderUrl` for every card. Product selection uses `buildRenderUrl`, never parsing `/products/` from the landing URL.

## Interfaces

Extend `CatalogProject` with optional `placementTemplates: Partial<Record<SizePresetId, Template>>`. Extend project PATCH with `placementTemplates` or a typed `variants` request and return `{ revision, variants: [{ sizeId, templateId, templateRevision, width, height }] }`. Validate the key matches template `sizeId` and canonical preset dimensions.

Keep `project.template` as the currently selected/backward-compatible template until all callers migrate. The API owns ID/revision assignment; clients never mark a placement saved before the returned project revision is confirmed.

## Validation

Add project route tests for migration, one atomic four-placement update, stale revision, invalid size/dimension, and durable failure with no saved-state change. Add pure editor-state tests for switching placements and partial standalone failures. Extend feed/render route tests to open each returned link for Shopify and WooCommerce source IDs and assert PNG width/height and template identity.

Manually edit a badge, save all, switch the master, change one variant, and verify only the corresponding status/link becomes stale. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run cf:build`.

## Completion handoff

Report the final project/API types, migration behavior, ID/revision table for all four placements, atomic failure evidence, provider round trips, browser screenshots, and command results. Move to `in-review`; call out any required render URL change for the versioned-render owner rather than implementing R2 caching here.

## Progress

- 2026-09-08 — Workflow follow-up resolved the remaining aggregate-success/mirror-failure finding. The project aggregate remains the required first write. Once it succeeds, a failure in the legacy standalone-template mirror is logged as a sanitized compatibility warning and no longer converts the confirmed project save into a 503 with a stale client revision. A route regression proves the master and all four placements advance together while the mirror throws. See [the resolved mirror decision](notes/2026-09-06-project-template-mirror-failure.md).
- 2026-09-05 — Picked up from `proposed` (specified, dependencies `done` except render-parity in `in-review`, treated as read-only). Prior code saved all-sizes as four disconnected standalone templates, discarded their IDs, and reused one PNG link per card.
- 2026-09-05 — `CatalogProject.placementTemplates` added (`src/lib/catalogProject.ts`) with `SizePresetId`, `SIZE_PRESET_IDS`, `savedPlacementTemplate` migration fallback (active template counts as its only saved placement), and `resolveProjectTemplate`. Feed and render routes accept saved placement IDs (unknown IDs still 404). No render-URL shape change: per-placement links address the placement template ID, which the versioned-render story can consume as-is.
- 2026-09-05 — PATCH accepts `placementTemplates`, validates every key/size/dimensions/layers before writing, assigns stable per-placement IDs with bumped revisions, writes the project aggregate once with `expectedRevision`, and returns `{ revision, variants: [{ sizeId, templateId, templateRevision, width, height }] }`. No standalone template writes for placements; validation or durable failure saves nothing.
- 2026-09-05 — New pure `src/editor/placementState.ts`: `buildPlacementVariants`, content `placementFingerprint`, `isPlacementSaved`, legacy `summarizeVariantSaves`. Editor seeds per-placement records on project load, saves all four in one PATCH (legacy mode retains each response and reports exact per-size outcome), and each preview card shows its own PNG link, an amber stale label, or Not saved. Fixed a real mismatch found by tests: stale checks now go through the same variant builder as saves (per-size naming included).
- 2026-09-05 — New `tests/placementExports.test.ts` (11: migration, resolution, fingerprinting, variant building, stale-after-edit, legacy summary, atomic save-all with ID preservation across re-saves, stale-revision 409 with no write, four invalid-payload 400s with no write, durable-failure 503 with state preserved) and `tests/placementRender.test.ts` (4: 9:16 Shopify render with own dims, WooCommerce exact-ID render, unknown-ID 404s on both routes, placement feed 200).
- 2026-09-05 — Review fixes (story stays in-review). Save-all now persists the master draft as `project.template` in the same atomic PATCH, so reopening restores the latest design; the single-save record is refreshed from the response. Placements are independently editable: each card has Edit/Resume, opening a `variant:<size>` draft; canvas edits, single saves, and stale states apply to that size only (server merges single-key placement saves). Size switching is disabled while editing a variant, with a Back-to-master banner. Added a subset-merge test plus draft-addressing/stale-override unit tests.
- 2026-09-05 — After review fixes: `npm run check` green (15 files, 83 tests, typecheck, 0 lint warnings); `npm run build` and `npm run cf:build` pass; `git diff --check` clean on authored paths. Outstanding manual evidence: edit a badge, save all, switch master, change one variant, verify only that card goes stale (needs a browser run).
- 2026-09-05 — Second review round, all fixed. Saved placements no longer show stale after reopen: variant drafts keep the base name (the `(variant)` suffix made saved snapshots mismatch fresh adaptations), plus a reload-freshness regression test. Save-all is atomicity-safe: the project aggregate now writes before the legacy standalone template mirror, so a 503 leaves no partial state; extended the failure test to the combined template-plus-placements payload asserting the aggregate is untouched and the mirror never ran. Missing-image parity: one shared `missingImageLabel`/size/color used by the browser preview, server PNG, and HTML string (14px `#a1a1a1`, `No image — <id>`); markup test pins the exact copy.
- 2026-09-05 — Third review round, all fixed. Cards use the saved snapshot as the reopened baseline via a pure `placementView` lineage (open draft → live master for the master size → saved snapshot → fresh adaptation), so a customized 4:5 renders its own design with a valid PNG instead of white-master content marked stale; save-all persists exactly what the cards display, so untouched customizations are never silently replaced. Header save button now reflects placement-saved state (no more `Save to Server` on an unchanged opened variant), and cards offer Reset to master for rejoining the master lineage. Lineage pinned by unit tests.
- 2026-09-06 — Follow-up review keeps this story `in-review`. The no-edit reload regression passes, but a stronger browser run found that a genuinely customized placement is still rendered and fingerprinted from a fresh master adaptation after reload. Repro: save all four, open 4:5, change its background to `#ffeecc`, save that placement, reload, then open All sizes; 4:5 renders the white master adaptation, shows `Stale — save again`, and hides its confirmed PNG until the placement is opened. Opening an unchanged saved variant also leaves the header save control labeled `Save to Server` because the header's `isSaved` calculation excludes `placementSavedForActive`. The temporary project fixture was restored byte-for-byte after the run. This finding was fixed and its note resolved in the fourth review.
- 2026-09-06 — Fourth review verified the reported snapshot fix in a real browser: a customized `#ffeecc` 4:5 placement survives reload with its own preview, valid PNG, `Saved ✓` header state, and Reset to master action. The saved-variant reload blocker is resolved. The story remains `in-review` because the required master-switch flow exposes a narrower lineage conflict: open the saved 4:5 placement, return to master, switch the master to 4:5, then save all. The card renders the retained `variant:4:5` draft while save-all special-cases the live master; the UI reports all four saved and the header says `Saved ✓`, but the 4:5 card immediately says `Stale — save again`. See the open master-switch lineage note. `npm run check` passes (15 files, 87 tests, typecheck, 0 lint warnings); the temporary project fixture was restored byte-for-byte.
- 2026-09-06 — Completed after fixing the master-switch lineage conflict. Save-all now resolves every candidate through `placementView`, including the master size. Promoting a size adopts its open draft or saved snapshot into the master document while preserving the master ID/revision and removes the duplicate `variant:<size>` draft, giving the canvas, card, save-all request, and reopened project one owner. Added a regression proving a customized placement can be promoted without losing its design. The full browser flow now stays fresh through save-all and reload: customized `#ffeecc` 4:5 snapshot → reopen → open draft → return to master → promote 4:5 → save all → reload; the master and card retain `#ffeecc`, the card keeps its PNG, and the header remains `Saved ✓`. Both placement blockers are resolved; the separate legacy mirror-failure finding remains open as a persistence-hardening follow-up. Final gates: `npm run check` passes (15 files, 88 tests, typecheck, 0 lint warnings), `npm run build` and `npm run cf:build` pass, and `git diff --check` is clean.
