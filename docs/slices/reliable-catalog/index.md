---
id: "reliable-catalog"
title: "Reliable Catalog — next slice"
description: "Import → customize → validate → publish, with correct output and durable saves"
order: 1
tone: "blue"
---

# Reliable Catalog — next slice

Status: implementation in progress. Import, validation, source mapping, project handoff, durable saves, exact-product rendering, browser/server render parity, placement persistence, versioned assets, guarded publication, and repository quality gates are complete. The full workflow proof remains.

## Outcome

A merchant can import a complete Shopify, WooCommerce, CSV, or remote CSV/XML catalog; inspect actionable validation results; customize a design; save placement-specific output; and publish one stable feed URL. Meta can anonymously fetch that feed and its PNGs. Reopening the project shows the saved draft, the last successful publication, and any later failed attempt without silently changing the live output.

Example: import a 250-row non-EUR CSV containing a sale item and one missing image, correct the source issue, save square, portrait, Story, and landscape variants, publish, then change one price and the badge design. The stable feed URL must point to new immutable image URLs while previously cached images keep their old content.

## Scope

This slice owns normalized import, full-snapshot validation, project persistence, exact product identity, browser/server render parity, placement-specific saved templates, R2 render caching, manual publication, and release evidence. It preserves the existing public-store Shopify and WooCommerce integrations and bounded remote feed fetcher.

Deferred work includes OAuth/private stores, scheduled upstream synchronization, source-data editing, direct Meta Catalog API pushes, conditional layers, asset libraries, analytics, and automatic optimization. Image dimension verification remains explicitly `not-run` until a separate validator implements it; the UI must not present that state as fully ready.

## Shared architecture and contracts

`CatalogProject` in `src/lib/catalogProject.ts` is the authenticated draft aggregate. `FeedRow` in `src/lib/facebook.ts` is the normalized catalog row. `Template` in `src/editor/types.ts` is the design document. Project-backed feed and render routes read saved project data; they never refetch an upstream catalog for each asset.

| Contract | Rule |
| --- | --- |
| Project identity | `prj_…` IDs are unguessable capability identifiers. Authenticated routes create, read, and update drafts. Anonymous feed/render routes may read only a published snapshot once the publication story lands. |
| Product identity | `FeedRow.source_id` is the internal stable render identity. Exported `id` remains the merchant-facing Meta ID. Never fall back from an unknown explicit `source_id` to a handle or another variant. |
| Revisions | Project and template revisions increase only after a confirmed durable save. Editor dirty state compares design content with the confirmed saved revision. Remaining stories add placement and product-content revision tokens to asset URLs. |
| Storage | Draft projects and standalone templates use `TEMPLATES_BUCKET`; generated PNG bytes use `RENDERS_BUCKET`. `/tmp` is development/test fallback only. Production storage errors are explicit and retryable. |
| Validation | `validateCatalog` is the one full-snapshot verdict used by preview, project, auditor, feed, and publication. Publication publishes rows without errors and skips rows with errors, recording the skipped product IDs; it is blocked by incomplete imports, empty catalogs, or catalogs with nothing publishable. Warnings remain visible and require explicit review rather than being relabeled ready. |
| Access | Project/template mutations require the existing admin session. Public feed and render URLs contain capability IDs, no credentials, and bounded validated parameters. Preserve render rate limiting and avoid logging capability URLs. |

### Placement output contract

Use `SizePresetId` values `1:1`, `4:5`, `9:16`, and `1.91:1` as durable output keys. UI placements map as follows: Carousel and Feed use `1:1`, Portrait uses `4:5`, Story uses `9:16`; Landscape uses `1.91:1` in the all-sizes workflow. Add a project-owned `placementTemplates` record containing complete saved `Template` snapshots. Keep the existing `template` and `placement` fields as the active/backward-compatible view during migration.

For a project-backed “save all,” persist all placement snapshots in one project update guarded by `expectedRevision`. Do not mark a project placement saved because a duplicate standalone template write succeeded. The project aggregate is authoritative for project feed/render output. Standalone `/api/templates` remains for legacy domain-based feeds.

### Versioned render contract

Build project render URLs from `projectId`, `source_id`, `sizeId`, saved template revision, and a deterministic product-content revision derived from render-relevant row fields. The URL and R2 key must change when title, price, sale price, image, binding data, template, or dimensions change. A cache hit returns the stored bytes; a cache miss renders exactly the referenced current revision and stores it before returning. Reject a stale or mismatched revision on a cache miss instead of generating different content under an old immutable URL.

Store assets beneath `renders/v2/`, including template identity in the key; sanitize path components. Feed-issued images carry `assetVersion=2` to bypass HTTP responses cached before the identity fix. Successful versioned responses may use long-lived immutable caching and an ETag. Ambiguous v1 objects are not reused; see the [review-fix migration decision](notes/2026-09-06-render-publication-review-fixes.md). Legacy domain/template URLs remain supported with their current shorter cache policy until intentionally migrated.

### Publication boundary

Draft save and publication are different transitions. Add a durable publication record keyed by project ID that contains the last successfully published project/output snapshot and the last attempt result. Anonymous project feed/render routes read this published record, not the mutable draft. A failed update preserves the prior published snapshot and records an actionable failure. The stable subscription URL remains `/api/feed?projectId=…`; its rows point to versioned immutable images.

One R2 object must be authoritative for the active published snapshot so a partial metadata write cannot make the UI and public feed disagree. Define and test recovery behavior before changing the current project feed path. Publication never claims that Meta imported or approved the feed; the final workflow story records that external evidence separately.

## Delivery order

Completed foundations: `c-reliable-catalog-project`, `c-reliable-feed-import`, `c-reliable-full-validation`, `c-reliable-store-mapping`, `c-reliable-editor-handoff`, `c-reliable-durable-saves`, `c-reliable-variant-render`, `c-reliable-render-parity`, `c-reliable-placement-exports`, `c-reliable-versioned-renders`, `c-reliable-publish-project`, and `c-reliable-quality-gates`.

1. **Next:** `c-reliable-workflow-check` exercises every supported source and coordinates with `c-external-render-release` for deployed Netlify/R2 and Meta evidence. It may fix integration defects but must not redesign earlier contracts silently.

Agents changing `CatalogProject`, render URL parameters, or publication storage must read every dependent spec and the slice notes first. Record cross-story changes as implementation notes and update the owning spec. Avoid parallel edits to `src/lib/catalogProject.ts`, `src/app/api/projects/route.ts`, and `src/app/editor/page.tsx` unless ownership is explicitly coordinated.

## Release evidence

1. Unit and route tests cover full import, non-EUR/sale normalization, errors after row 50, durable-save failure, stale revisions, exact variant selection, shared render styles, placement IDs/dimensions, render cache misses/hits, and publication rollback.
2. A local browser run shows saved/unsaved transitions, four independently saved placement links, server PNG parity for representative stress fixtures, publish/reopen/update state, and actionable failures.
3. A Cloudflare runtime run proves R2 draft and render bindings, immutable asset reuse, changed URLs after product/design updates, and anonymous access to the published feed and images.
4. A manual Meta test records the catalog import result without credentials or capability URLs in committed evidence. A successful application build alone does not prove external acceptance.
5. `npm run story-map:check`, the consolidated quality command, `npm run build`, and `npm run cf:build` pass. Remaining warnings and platform limitations are recorded in the relevant story Progress section.

The slice is complete only when all thirteen stories are reviewed against their acceptance criteria and the workflow proof contains both local failure evidence and the external publication result.
