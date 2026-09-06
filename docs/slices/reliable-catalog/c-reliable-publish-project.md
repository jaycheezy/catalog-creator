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

## Scope

Own the explicit draft-to-published transition, one authoritative durable publication record, authenticated publish API/UI, stable project feed URL, and anonymous reads of the last successful snapshot. Cover first publication, republishing an updated draft, reopening status, and failed update recovery. Exclude scheduled source sync, Meta API submission/status, rollback selection among old releases, private signed feed URLs, and deleting published assets.

## Implementation guidance

Read [the publication boundary](index.md), the project/validation/placement/versioned-render specs, `src/lib/catalogProject.ts`, project storage and APIs, `src/app/api/feed/route.ts`, `src/app/api/render/route.tsx`, and the editor publish controls. Follow the local Next.js route/runtime documentation required by `AGENTS.md`.

Add one `CatalogPublicationRecord` per project under a versioned key such as `catalog-publications/v1/<project-hash>.json`. Its active snapshot must contain the normalized catalog, validation verdict/version, selected placement outputs, immutable render descriptors, source summary needed for UI, published project revision, and `publishedAt`. Store the last attempt separately in the same object with status, attempted draft revision, timestamp, and a sanitized actionable error. Do not store credentials or upstream secrets.

Implement an authenticated publish operation guarded by `expectedRevision`. Re-read the draft, reject stale or incomplete imports and validation errors, require the selected placement template plus all data needed by the feed, and build every feed row against immutable render descriptors. Perform any bounded asset readiness probes/generation before the authoritative publication write. Write the complete new active snapshot and attempt result in one R2 object update. If preparation or the write fails, preserve the prior active snapshot and persist the failure only when that can be done without replacing it; the public feed must never observe a half-published release.

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
