---
id: netlify-cache-query-isolation
title: R2 hits work; Netlify cache ignores catalog query parameters
type: blocker
status: resolved
author: Codex
updated: "2026-09-07"
affects: [c-external-render-service, c-external-render-adapter, c-external-render-release, c-reliable-versioned-renders]
---

## Summary

Resolved on owner confirmation: in the follow-up, the owner stated the deployment/cache checks had all been completed and requested continuation. The original observations below are historical; this turn did not independently repeat the hosted matrix.

Production R2 reuse works for the supplied published image. The repeated `X-Render-Cache: miss` observation was a cached origin header, not evidence of repeated rasterization. A separate production defect is confirmed: Netlify caches `/api/render` without varying on catalog query parameters, so a request for another placement receives the first cached square PNG. A local fix adds `Netlify-Vary: query` to every API response through `next.config.ts`; deployment and hosted verification remain required.

## Evidence

Read-only anonymous probes against the owner-supplied Netlify URL on 2026-09-07, around 19:09–19:11 UTC. Full capability URLs and ETags are deliberately omitted.

| Probe | Observed result |
| --- | --- |
| Original versioned square image | 200 PNG, 1,246,266 bytes, 1080×1080; `Age: 35088`; `Cache-Status: "Netlify Durable"; hit`; `X-Render-Cache: miss`. |
| Same asset with an arbitrary `cacheProbe` parameter and request `Cache-Control: no-cache` | Same bytes, durable hit, age 35112. This did **not** bypass the CDN. |
| Change only `sizeId` from `1:1` to `9:16` | Same square PNG and ETag, durable hit, age 35139. The route should return the requested placement or its validation error, never another placement's cached image. |
| Original asset with a unique `_rsc` parameter (included in the deployed cache variation) | 200, `Cache-Status: "Netlify Durable"; fwd=vary-miss; stored`, `X-Render-Cache: hit`, age 1, identical bytes. The origin's R2-hit branch succeeded; no re-rasterization is required on that branch. |

All PNG responses had SHA-256 `98505fbcfcdb9e68ded3d48b7c7c122048f1892bbbf4f69686ac1b196196ffbf`. The deployed `Netlify-Vary` query instruction was only `query=__nextDataReq|_rsc`, followed by framework header/cookie variations. It omitted product, project, template, size, revision and draft parameters.

[Netlify's caching documentation](https://docs.netlify.com/build/caching/caching-overview/) specifies `Netlify-Vary: query` for all query parameters, explains the `Cache-Status` layers, and requires consistent variation instructions across responses for a path. The Next configuration applies this consistently to `/api/:path*`, including errors and draft requests. It preserves each route's existing Cache-Control policy and the adapter's framework variation requirements.

The prior agent's successful CSV and direct R2 object download are owner-supplied evidence, not newly repeated here. No Netlify logs, environment values, R2 metrics or billing dashboard were accessed. There is no evidence here for an SDK read failure or repeated render CPU charges. CDN delivery can still consume request/bandwidth allowance.

Local validation: `npm run build` passed; `npm run check` passed (21 test files, 133 tests, TypeScript and ESLint; story map: 50 stories, 12 notes). A running production Next build returned `Netlify-Vary: query` on render validation errors and render/feed draft errors; both draft responses retained `private, no-store`. This verifies Next configuration emission, not the deployed Netlify adapter or CDN behavior.

## Impact

This blocks hosting/release sign-off because catalog identity lives in query parameters. Wrong product/revision/template/project responses and feed collisions are risks implied by the same cache configuration; only the placement collision was exercised in production. Draft no-store responses cannot repair a CDN hit that occurs before the handler runs. Keep draft isolation in the deployment smoke matrix.

The S3 adapter needs no speculative repair. Separate Netlify edge/durable hits from application R2 hits when judging the free-plan cost model; latency and `X-Render-Cache` alone are insufficient. Existing browser/consumer caches may retain wrong immutable responses for previously requested URLs even after CDN invalidation.

## Next action

The original remediation checklist below is retained as a regression procedure, not outstanding deployment work. Continue with the [release handoff](../../../research/external-render-service/release.md).

Deploy the `next.config.ts` fix, verify effective Netlify-Vary includes **all** query parameters while retaining required framework variations, and ensure prior broad cache entries are invalidated (verify the atomic deploy clears them; purge if they remain). Use fresh HTTP clients, then test multiple products, all placements, project/template/revision changes, anonymous and authenticated drafts, unpublished projects, and feed query isolation. Record CDN-hit and origin/R2-hit evidence separately. If a consumer already cached a wrong immutable response, use a deliberate URL cache-buster after the fix and re-export/re-fetch the feed; do not overwrite immutable R2 objects or assume a CDN purge clears browser/Meta caches. Close this blocker only with hosted regression evidence.
