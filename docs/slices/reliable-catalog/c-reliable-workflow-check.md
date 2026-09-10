---
id: "c-reliable-workflow-check"
slice: "reliable-catalog"
title: "Prove the complete non-demo catalog journey"
step: "test"
status: "in-review"
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

- 2026-09-10 — Application-owned browser acceptance now passes against the compiled app in an isolated local-storage process. A 75-row CHF/sale CSV survived import, editor reopen, save-all, four fresh placement links, publication, reload, dirty-state publication blocking, save, and republish. Anonymous requests returned the stable 75-row feed and exact `1080×1080`, `1080×1350`, `1080×1920`, and `1200×628` PNGs with repeat ETag/byte stability. A visible title-color edit changed the immutable image URL, ETag, and pixels while the prior image stayed available; the inspected long-title/sale-badge PNG did not clip. Desktop and 390×844 controls were usable, and reload preserved source, design, saved state, and live revision. Results are redacted in the [local browser response artifact](../../research/evidence/reliable-catalog/local-browser-2026-09-10.md). The story moves to `in-review`; current Netlify cache/failure evidence remains owned by unfinished prerequisite `c-external-render-release`, and the manual Meta import remains an explicit external action.
- 2026-09-10 — Earlier checkpoint: the full application gate passed after the first workflow hardening round (23 files / 152 tests, typecheck and lint without warnings, Next and OpenNext/Cloudflare builds, story-map validation, and clean diff whitespace). Automated coverage included all source types, representative XML/CSV problems, durable-save recovery, publication/reopen/update, exact variants, and four placements. The local desktop/narrow capture was temporarily unavailable after the repository wrapper hit `EMFILE` and a direct localhost launch could not be approved in that session; the later browser run above closes that evidence gap. Current Netlify failure/recovery evidence and the manual Meta result remain outstanding.
- 2026-09-08 — Application-owned workflow consolidation started while `c-external-render-release` remains an explicit unfinished dependency. Added the [release evidence index](../../research/reliable-catalog-workflow.md) with separate automated, local-runtime, Netlify-baseline, browser, and Meta rows. Representative route fixtures now create and reopen Shopify, WooCommerce, remote CSV, and remote XML projects; the XML fixture covers entity decoding, a CHF sale, stable row identity, and an exact missing-image finding. Uploaded CSV coverage now proves a malformed decimal after row 50 survives normalization and reaches the shared `invalid-price` verdict. Resolved the open project/template mirror ambiguity: after the authoritative aggregate succeeds, a compatibility-mirror failure is logged without capability IDs and the client still receives the confirmed revision. Focused source/save regressions pass. Current hosted deployment and manual Meta acceptance do not yet include this working tree, so no production or external completion is claimed.

## Acceptance criteria

- Cover Shopify variants, WooCommerce, a feed URL, and CSV with fixtures for missing images, sale prices, non-EUR currencies, and more than 50 rows.
- Check source/design continuity, durable save failures, exact variant output, each placement, and fresh images after updates.
- Verify an anonymous feed fetch in Cloudflare and record a manual Meta catalog import result before calling the slice complete.

## Scope

Own the release-level test matrix, representative fixtures, local browser evidence, Cloudflare runtime evidence, manual Meta import record, and fixes for integration defects revealed by that journey. Exercise import → customize → validate → save placements → publish → anonymous fetch → reopen → update → republish. Exclude new product capability, load testing beyond representative catalog sizes, automated Meta account actions, and redesigning an owning story's contract without updating that spec and recording a decision note.

## Implementation guidance

Read every Reliable Catalog story and open implementation note before starting. Build deterministic fixtures for: Shopify with two variants whose images/prices differ; WooCommerce with sale pricing; uploaded CSV and remote CSV/XML with a non-EUR currency; more than 50 rows with an error after row 50; a missing image; a corrupt decimal price; and a long-title/sale-badge design using rotation, opacity, borders, and shadows. Reuse fixture builders where possible so route and browser expectations describe the same products.

Automate repeatable application-owned checks, then use browser/runtime evidence for behaviors a unit test cannot establish. The browser journey must retain `projectId`, source summary, product selection, design revisions, four placement snapshots, publication status, and exact output links through reloads. Inject or simulate durable project, render bucket, and publication failures and prove saved/live state is preserved with an actionable retry path.

Run the real built application in the Cloudflare/OpenNext environment with both durable buckets bound. From a clean session, publish each source type and fetch the stable CSV plus representative PNGs anonymously. Confirm exact variant rows, correct dimensions, cache reuse, and new immutable URLs after a price/image/design republish. Never commit cookies, credentials, raw capability IDs, merchant-private URLs, or environment dumps.

Complete one manual Meta catalog data-source import using the anonymous stable feed. Record date, environment/build identifier, item count, accepted/rejected status, and sanitized diagnostics. This is external evidence, not an automated API action. If access is unavailable, leave the story `in-review` with that criterion visibly outstanding rather than marking the slice done.

## Interfaces

Create `docs/research/reliable-catalog-workflow.md` as the release evidence index. Store sanitized screenshots or response artifacts under `docs/research/evidence/reliable-catalog/` and link them from the index. Use a matrix with source type, fixture, import/validation result, placements, publication result, anonymous response, update result, and evidence link. Include exact commands and build identifiers needed to reproduce the run.

Test helpers may expose typed fixture factories and storage fault controls, but production interfaces remain owned by their stories. Any integration fix must add a focused regression at the closest public boundary and update the relevant story Progress section.

## Validation

Run the consolidated quality gate, the full unit/route suite, type checking, lint, production build, and Cloudflare build. Run the browser matrix at desktop and a narrow viewport for the editor's save/publish controls. Inspect returned PNG dimensions and representative visual parity rather than treating HTTP 200 as sufficient.

The evidence index must show all acceptance rows, including errors after row 50, non-EUR/sale output, missing image, corrupt decimal rejection, durable-save failure, exact variant identity, four placement dimensions, anonymous access, cache hit, new URLs after updates, failed republish preserving live output, reopen state, and the manual Meta result. Redact secrets and capability values before committing.

## Completion handoff

Report the final fixture/evidence matrix, application defects fixed with owning-story links, all command/build results, Cloudflare anonymous response evidence, cache/update proof, and Meta import outcome. Move to `in-review` only when every application-owned criterion passes; list any external access item separately. Mark `done` only after the evidence is reviewed and no acceptance criterion is inferred from a different check.

## External renderer prerequisite

The recorded Free-plan production PNG failure makes `c-external-render-release` a prerequisite for this end-to-end proof. Reuse its deployed cache/PNG/CPU evidence from `docs/research/external-render-service/release.md` when available; this story still owns the complete source matrix and manual Meta import. Do not infer external acceptance from the renderer release. See [the contract review](../external-render-service/notes/2026-09-06-external-render-contract-review.md).
