---
id: "c-reliable-workflow-check"
slice: "reliable-catalog"
title: "Prove the complete non-demo catalog journey"
step: "test"
status: "done"
effort: "M"
order: 18
tags: ["next"]
dependsOn: ["c-reliable-catalog-project", "c-reliable-feed-import", "c-reliable-full-validation", "c-reliable-store-mapping", "c-reliable-durable-saves", "c-reliable-render-parity", "c-reliable-placement-exports", "c-reliable-variant-render", "c-reliable-versioned-renders", "c-reliable-publish-project", "c-reliable-quality-gates", "c-external-render-release"]
implementation: "specified"
value: "Tests the full journey from import to publish with real examples, so the everyday route just works without surprises."
---

# Prove the complete non-demo catalog journey

## Summary

Exercise import → customize → validate → save → publish → reopen → update with representative catalogs and failure cases.

## Progress

- 2026-09-11 — Manual Meta acceptance passes against the reviewed Netlify deployment. An authorized Commerce Manager catalog fetched the anonymous stable feed as a scheduled daily EUR data source. The non-deleting update imported all 30 incoming rows: updated or added 30, removed 0, failed 0, issues 0; the data source retained one prior product for 31 total as expected. Meta's preview recognized the deployed versioned render URLs before upload. Capability identifiers and full URLs are omitted from the [sanitized Meta evidence](../../research/evidence/reliable-catalog/meta-import-2026-09-11.md). Together with the complete local, Netlify, cache, failure, browser, and source matrix, this closes the final acceptance item and moves the story to `done`.

- 2026-09-11 — The external-render release prerequisite gained reviewable isolated invalid-credential failure/recovery evidence and moved to `in-review`. Shared credentials and publication records remained unchanged. At this checkpoint this workflow story stayed `in-review` for its explicit manual Meta import; the entry above closes it.

- 2026-09-10 — The reviewed code is now verified on Netlify deploy `6aa303eed8f0140008f61cf6` / commit `622cf2f`. The 75-row CHF/sale journey passed stable-feed publish/reopen/update, immediate same-URL freshness, new/old immutable PNG behavior, Netlify Edge and origin R2 reuse, product/project/template/placement/revision/draft isolation, private authenticated draft rendering, bounded 422 publish failure/recovery, and exact dimensions for all four versioned placement feeds. Browser inspection showed the live app, restored 75-product project, `Saved ✓`, Republish, feed copy/download controls, all sizes, and an unclipped long-title render with no console warnings/errors. Free Legacy usage totals and capacity projection are also recorded. See the [sanitized production artifact](../../research/evidence/external-render-service/netlify-production-2026-09-10.md). This story remains `in-review` for its explicit manual Meta import; the release prerequisite's R2-outage check is closed by the September 11 entry above.

- 2026-09-10 — Application-owned browser acceptance now passes against the compiled app in an isolated local-storage process. A 75-row CHF/sale CSV survived import, editor reopen, save-all, four fresh placement links, publication, reload, dirty-state publication blocking, save, and republish. Anonymous requests returned the stable 75-row feed and exact `1080×1080`, `1080×1350`, `1080×1920`, and `1200×628` PNGs with repeat ETag/byte stability. A visible title-color edit changed the immutable image URL, ETag, and pixels while the prior image stayed available; the inspected long-title/sale-badge PNG did not clip. Desktop and 390×844 controls were usable, and reload preserved source, design, saved state, and live revision. Results are redacted in the [local browser response artifact](../../research/evidence/reliable-catalog/local-browser-2026-09-10.md). At this checkpoint the story moved to `in-review` while the renderer prerequisite and manual Meta import were still open; the September 11 entries close both items.
- 2026-09-10 — Earlier checkpoint: the full application gate passed after the first workflow hardening round (23 files / 152 tests, typecheck and lint without warnings, Next and OpenNext/Cloudflare builds, story-map validation, and clean diff whitespace). Automated coverage included all source types, representative XML/CSV problems, durable-save recovery, publication/reopen/update, exact variants, and four placements. The local desktop/narrow capture was temporarily unavailable after the repository wrapper hit `EMFILE` and a direct localhost launch could not be approved in that session; the later browser and production entries close those evidence gaps.
- 2026-09-08 — Application-owned workflow consolidation started while `c-external-render-release` was an unfinished dependency. Added the [release evidence index](../../research/reliable-catalog-workflow.md) with separate automated, local-runtime, Netlify-baseline, browser, and Meta rows. Representative route fixtures now create and reopen Shopify, WooCommerce, remote CSV, and remote XML projects; the XML fixture covers entity decoding, preserves a CHF sale, creates stable row identity, and reports the exact missing-image row. Uploaded CSV coverage proves a malformed decimal after row 50 survives normalization and reaches the shared `invalid-price` verdict. Resolved the open project/template mirror ambiguity: after the authoritative aggregate succeeds, a compatibility-mirror failure is logged without capability IDs and the client still receives the confirmed revision. Focused source/save regressions passed. Later September 10–11 entries provide the production, browser, outage, and Meta evidence that was not yet available at this checkpoint.

## Acceptance criteria

- Cover Shopify variants, WooCommerce, a feed URL, and CSV with fixtures for missing images, sale prices, non-EUR currencies, and more than 50 rows.
- Check source/design continuity, durable save failures, exact variant output, each placement, and fresh images after updates.
- Verify an anonymous feed fetch on the selected production host, backed by Cloudflare R2, and record a manual Meta catalog import result before calling the slice complete.

## Scope

Own the release-level test matrix, representative fixtures, local browser evidence, deployed runtime evidence, manual Meta import record, and fixes for integration defects revealed by that journey. Exercise import → customize → validate → save placements → publish → anonymous fetch → reopen → update → republish. Exclude new product capability, load testing beyond representative catalog sizes, automated Meta account actions, and redesigning an owning story's contract without updating that spec and recording a decision note.

## Implementation guidance

Read every Reliable Catalog story and open implementation note before starting. Build deterministic fixtures for: Shopify with two variants whose images/prices differ; WooCommerce with sale pricing; uploaded CSV and remote CSV/XML with a non-EUR currency; more than 50 rows with an error after row 50; a missing image; a corrupt decimal price; and a long-title/sale-badge design using rotation, opacity, borders, and shadows. Reuse fixture builders where possible so route and browser expectations describe the same products.

Automate repeatable application-owned checks, then use browser/runtime evidence for behaviors a unit test cannot establish. The browser journey must retain `projectId`, source summary, product selection, design revisions, four placement snapshots, publication status, and exact output links through reloads. Inject or simulate durable project, render bucket, and publication failures and prove saved/live state is preserved with an actionable retry path.

Run the real built application locally and on the selected production host with both durable buckets available. From a clean session, publish each source type and fetch the stable CSV plus representative PNGs anonymously. Confirm exact variant rows, correct dimensions, cache reuse, and new immutable URLs after a price/image/design republish. Never commit cookies, credentials, raw capability IDs, merchant-private URLs, or environment dumps.

Complete one manual Meta catalog data-source import using the anonymous stable feed. Record date, environment/build identifier, item count, accepted/rejected status, and sanitized diagnostics. This is external evidence, not an automated API action. If access is unavailable, leave the story `in-review` with that criterion visibly outstanding rather than marking the slice done.

## Interfaces

Create `docs/research/reliable-catalog-workflow.md` as the release evidence index. Store sanitized screenshots or response artifacts under `docs/research/evidence/reliable-catalog/` and link them from the index. Use a matrix with source type, fixture, import/validation result, placements, publication result, anonymous response, update result, and evidence link. Include exact commands and build identifiers needed to reproduce the run.

Test helpers may expose typed fixture factories and storage fault controls, but production interfaces remain owned by their stories. Any integration fix must add a focused regression at the closest public boundary and update the relevant story Progress section.

## Validation

Run the consolidated quality gate, the full unit/route suite, type checking, lint, production build, and Cloudflare build. Run the browser matrix at desktop and a narrow viewport for the editor's save/publish controls. Inspect returned PNG dimensions and representative visual parity rather than treating HTTP 200 as sufficient.

The evidence index must show all acceptance rows, including errors after row 50, non-EUR/sale output, missing image, corrupt decimal rejection, durable-save failure, exact variant identity, four placement dimensions, anonymous access, cache hit, new URLs after updates, failed republish preserving live output, reopen state, and the manual Meta result. Redact secrets and capability values before committing.

## Completion handoff

Report the final fixture/evidence matrix, application defects fixed with owning-story links, all command/build results, deployed anonymous response evidence, cache/update proof, and Meta import outcome. Move to `in-review` only when every application-owned criterion passes; list any external access item separately. Mark `done` only after the evidence is reviewed and no acceptance criterion is inferred from a different check.

## External renderer prerequisite

The recorded Free-plan production PNG failure makes `c-external-render-release` a prerequisite for this end-to-end proof. Reuse its deployed cache/PNG/CPU evidence from `docs/research/external-render-service/release.md` when available; this story still owns the complete source matrix and manual Meta import. Do not infer external acceptance from the renderer release. See [the contract review](../external-render-service/notes/2026-09-06-external-render-contract-review.md).
