---
id: "c-reliable-publish-project"
slice: "reliable-catalog"
title: "Publish and reopen the correct project feed"
step: "publish"
status: "in-review"
effort: "M"
order: 17
tags: ["next"]
dependsOn: ["c-reliable-full-validation", "c-reliable-placement-exports", "c-reliable-versioned-renders"]
implementation: "specified"
value: "Keeps your published product feed saved and reopenable, so you can update it later without rebuilding it from scratch."
---

# Publish and reopen the correct project feed

## Summary

Make the feed URL a durable project output that can be reopened and updated after leaving the editor, including projects created from CSV or feed URLs.

## Progress

- 2026-09-10 — Production verification reopened review after deploy `6aa2fe6d9942ce0008928f2d` exposed a stale stable-feed response after a successful republish. The project feed advertised a one-hour shared-cache TTL, so Netlify could return the previous CSV and old immutable image URL. The local fix makes stable `projectId` feeds revalidate on every request while leaving legacy store feeds and immutable PNG caching intact. Public-boundary regressions pass (3 files / 28 tests); the full gate is green (23 files / 152 tests, typecheck, 0 lint warnings, Next build, OpenNext/Cloudflare build, and clean diff whitespace). Redeploy and same-URL production proof are required before returning this story to `done`; see [the production blocker](../external-render-service/notes/2026-09-10-netlify-stable-feed-staleness.md).

- 2026-09-08 — Completed after final review closed the publication race and draft-safety gaps. Publish now requires an exact `expectedRevision`, rejects noncanonical or incomplete placement templates, and refuses to publish while the editor has unsaved master or placement drafts. Source summaries retain only a CSV basename or remote origin, so signed query parameters, credentials, and local paths never enter the frozen record. Publication activation and failure recording use conditional R2/S3 writes with bounded retries: an older success or failed attempt cannot replace a newer active snapshot or erase newer attempt history, while a duplicate publish of the same revision is idempotent. Capability project IDs were removed from storage-error logs. New storage, route, adapter, source-sanitization, and editor-state regressions pass. `npm run check` is green (23 files / 149 tests, typecheck, 0 lint warnings), and the OpenNext/Cloudflare build passes. An isolated Workerd run against persisted local R2 proved missing-revision rejection, two concurrent same-revision publishes returning the same activation time, reopen at revision 1, anonymous feed access, and identical PNG bytes across `miss` → `hit`. Netlify is the current production route through the R2 S3 adapter; deployed evidence remains with `c-external-render-release`, and the supported-source/Meta proof remains with `c-reliable-workflow-check`.
- 2026-09-06 — Publish-valid-rows policy adopted: the endpoint publishes rows without errors and skips error rows with recorded IDs/codes (re-validated subset verdict frozen in the snapshot); only incomplete imports, empty catalogs, and fully-invalid catalogs 422. Blocking-failure messages now name error-severity codes only (warnings/info excluded). Snapshot, attempt, summary, publish response, and editor publish bar all carry skipped rows with an amber live-feed notice and reopen-safe counts. Slice contract updated to match. Story stays `in-review` pending review.

- 2026-09-06 — Review fixes: draft CSVs now emit authenticated draft image targets, all `draft=1` responses are `private, no-store`, publication project-read failures return retryable 503 JSON, and absent publication records return `{ active: null, lastAttempt: null }` while storage failures retain unavailable status. The shared render fixes prevent draft cache exposure and preserve cached images after a placement change. All 125 tests, typecheck, lint, both production builds, and an isolated local real-PNG publication run pass. See [the shared review-fix decision](notes/2026-09-06-render-publication-review-fixes.md). Story stays `in-review`.
- 2026-09-06 — Picked up with versioned-renders implemented but unreviewed (treated as read-only). New `src/lib/catalogPublication.ts` (`CatalogPublicationSnapshot`, `PublicationAttempt`, `CatalogPublicationRecord`, schema version 1, `catalog-publications/v1/<projectId>.json` keys — the project ID is already an unguessable capability so no extra hash) and `src/lib/catalogPublicationStore.ts` (R2 via the templates bucket plus the established `/tmp` dev fallback).
- 2026-09-06 — New `POST /api/projects/publish` (`src/app/api/projects/publish/route.ts`): authenticated, `expectedRevision`-guarded; rejects incomplete imports, empty catalogs, invalid templates, and blocked validation with 422s that persist a failed attempt without touching the active snapshot; writes the complete record in one atomic R2 put (prior snapshot preserved on any failure; 503 on write failure). Returns the stable `/api/feed?projectId=…` URL, placement descriptors, frozen validation verdict, and attempt status. `GET /api/projects` now carries a publication summary for reopen (null only when unreadable, never confused with never-published).
- 2026-09-06 — Publication boundary enforced in both routes: clean project URLs always read the frozen snapshot (unpublished → stable 404, storage failure → 503); owner draft previews use explicit authenticated `?draft=1` on legacy URLs, never shared links. Feed builds versioned image links from snapshot data; render verifies revisions against the snapshot and falls back to exact-key `hit-stale` serving so superseded published PNGs keep their bytes. Editor previews switched from versioned to legacy+draft links (versioned URLs pin revisions, so they cannot preview unsaved work) — recorded as a correction to the versioned-renders Progress, whose server/feed contract is untouched. Editor gained Publish/Republish with never/draft-newer/failed-preserved states, stable-URL copy/download gated on publication, and no Meta-import claims.
- 2026-09-06 — New `tests/publication.test.ts` (11: first publish, 401/stale, validation/incomplete blocks with attempt records, write-failure preservation, republish with new immutable images through a stable URL, old-asset survival with `hit-stale`, draft invisibility, draft-vs-shared split, unpublished 404s, reopen summary, all four source types). Updated `feed-render`, `placementRender`, `renderParity`, and `versionedRenders` suites to seed publication records for anonymous project reads; the versioned price-change test now republishes instead of mutating the draft.
- 2026-09-06 — `npm run check` green (17 files, 113 tests, typecheck, 0 lint warnings); `npm run build` and `npm run cf:build` pass; authored diff clean. Live Cloudflare/Meta evidence belongs to the workflow-check story.

## Acceptance criteria

- Copy/download uses the active project's source, validated catalog, saved template, and placement.
- Reopening a project restores its published feed URL and shows the last successful publication plus any update failure.
- An anonymous fetch returns the correct CSV and image assets; project updates refresh assets without requiring a new feed subscription.
- Publishing skips rows with error-severity issues, records the skipped product IDs, and warns in the UI; only incomplete imports, empty catalogs, and fully-invalid catalogs are rejected.

## Scope

Own the explicit draft-to-published transition, one authoritative durable publication record, authenticated publish API/UI, stable project feed URL, and anonymous reads of the last successful snapshot. Cover first publication, republishing an updated draft, reopening status, and failed update recovery. Exclude scheduled source sync, Meta API submission/status, rollback selection among old releases, private signed feed URLs, and deleting published assets.

## Implementation guidance

Read [the publication boundary](index.md), the project/validation/placement/versioned-render specs, `src/lib/catalogProject.ts`, project storage and APIs, `src/app/api/feed/route.ts`, `src/app/api/render/route.tsx`, and the editor publish controls. Follow the local Next.js route/runtime documentation required by `AGENTS.md`.

Add one `CatalogPublicationRecord` per project under a versioned key such as `catalog-publications/v1/<project-hash>.json`. Its active snapshot must contain the normalized catalog, validation verdict/version, selected placement outputs, immutable render descriptors, source summary needed for UI, published project revision, and `publishedAt`. Store the last attempt separately in the same object with status, attempted draft revision, timestamp, and a sanitized actionable error. Do not store credentials or upstream secrets.

Implement an authenticated publish operation guarded by `expectedRevision`. Re-read the draft, reject stale revisions, incomplete imports, empty catalogs, and catalogs with nothing publishable; skip rows with error-severity issues while recording their product IDs and codes, and re-validate the published subset for the frozen verdict. Require the selected placement template plus all data needed by the feed, and build every feed row against immutable render descriptors. Perform any bounded asset readiness probes/generation before the authoritative publication write. Write the complete new active snapshot and attempt result in one R2 object update. If preparation or the write fails, preserve the prior active snapshot and persist the failure only when that can be done without replacing it; the public feed must never observe a half-published release.

After this story lands, anonymous `projectId` feed and render paths read only the active publication snapshot. An unpublished capability ID returns a stable non-success response. Saving a draft never changes public output. Republish keeps `/api/feed?projectId=…` stable while its rows adopt new immutable PNG URLs. Legacy domain/template feeds retain their current behavior.

Restore publication state when reopening the editor. Show never published, last published time/revision, draft newer than publication, publishing, last attempt failed, and current states. Copy/download must use the active project feed URL only after successful publication; a failed republish keeps the prior link active and explains that the live feed was preserved. Do not describe a successful publish as a successful Meta import.

## Interfaces

Define `CatalogPublicationSnapshot`, `PublicationAttempt`, and `CatalogPublicationRecord` with an explicit schema version. Add an authenticated endpoint such as `POST /api/projects/publish` accepting `{ id, expectedRevision }` and returning the published revision, time, stable feed URL, placement descriptors, and attempt status. Add a read representation to the project response so editor reload does not infer publication from local state.

Create shared storage helpers with conditional/revision checks where the R2 API supports them. The project feed loader returns either the active published snapshot or a typed unpublished/unavailable result. Public error payloads must not expose bucket keys, credentials, upstream URLs containing secrets, or full internal failure traces.

## Validation

Add storage/route tests for first publish, stale expected revision, validation errors, incomplete imports, missing placement output, successful republish, preparation failure, authoritative-write failure, and reopen. Prove every failure keeps the previous anonymous feed byte-for-byte stable. Assert a draft-only price/design change is invisible publicly and becomes visible after republish through a new immutable image URL while the subscription URL stays unchanged.

Test anonymous feed and image access with a project created from Shopify, WooCommerce, uploaded CSV, and remote feed data, including exact variant identity. In a Cloudflare preview, publish, fetch without cookies, update/reopen/republish, and record R2 object and response evidence with IDs redacted. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run cf:build`.

## Completion handoff

Report the publication schema/version, storage key policy, API request/response, state-machine table, stable feed example with capability values redacted, first-publish and failed-republish evidence, anonymous Cloudflare results, and command results. Move to `in-review`; leave the external Meta import claim for the workflow-check story.
