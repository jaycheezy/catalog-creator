---
id: reliable-render-publication-review-fixes
title: Isolate published render identities and private draft responses
type: decision
status: resolved
author: Codex
updated: "2026-09-08"
story: c-reliable-versioned-renders
affects:
  - c-reliable-publish-project
---

## Summary

The six original review findings are fixed. Published render keys include template identity; cached square assets survive a master switch to portrait; draft CSVs and images remain private; draft feed images resolve against the draft; publication read failures return retryable JSON; and never-published projects have an empty publication summary rather than an unavailable state. A final versioned-render review also added `inventory` to product identity and preserved exact cached assets after later publications remove their product or template. The publication review then made expected revisions mandatory, protected activation and failure writes with conditional storage updates, sanitized source summaries, validated canonical placement snapshots, and blocked publishing unsaved editor designs. Versioned renders and publication are `done`.

## Evidence

- `npm run check`: 19 files, 125 tests passed; typecheck and lint passed without warnings.
- `npm run build` and `npm run cf:build`: passed. OpenNext retains its existing warning that Node.js middleware support on Cloudflare is experimental.
- `tests/renderReviewFixes.test.ts`: distinct bytes/ETags for master and customized placement at matching revisions, repeated cache hit, cached image survival after changing size, private versioned drafts, and rejection of draft-only assets through the public stale lookup.
- `tests/draftFeedReviewFixes.test.ts`: unpublished draft feed/image round-trip, authenticated/anonymous separation, draft headers, and unchanged public feed cache policy.
- `tests/publication.test.ts`: retryable 503 on project read failure and distinct absent/unavailable publication summaries. `tests/renderProduct.test.ts` covers HTTP URL migration.
- A local production server with explicit local-storage fallback returned real PNGs for an isolated CSV project. The HTTP run checked never-published status, private draft CSV/PNG, anonymous rejection before publication, distinct placement images at matching revisions, cache-hit byte equality, and an unchanged cached square image after portrait republish through the same feed subscription. The fixture records were removed afterward. This is local runtime evidence, not live Cloudflare/R2 or Meta evidence.
- Final versioned-render review: `npm run check` passed 21 files / 138 tests, typecheck, and lint without warnings; `npm run cf:build` passed. New regressions prove every normalized `FeedRow` field, including `inventory`, changes the content revision and prove exact cached URLs survive later product/template removal while uncached URLs retain their 404 response.
- An isolated OpenNext Worker build omitted `.env`, forcing the local Cloudflare bindings shown by Wrangler. The create, publish, and feed requests returned 200; a real 18,251-byte PNG produced `X-Render-Cache: miss` then `hit`, with identical bytes, ETag, and `public, max-age=31536000, immutable`. Restarting the Worker against the same persisted local R2 state returned another hit with the same ETag and byte length. Wrangler 4.127.1 supports compatibility dates only through `2026-09-04`, so this local run overrode the checked-in `2026-09-05` date by one day; the normal Cloudflare build passed with the checked-in date.
- Final publication review: `npm run check` passed 23 files / 149 tests, typecheck, and lint without warnings; the OpenNext/Cloudflare build passed. Storage regressions simulate lost compare-and-swap races and prove neither an older success nor a failed attempt can replace a newer activation or erase newer attempt history. Route tests require the exact draft revision, reject malformed placement snapshots, and strip credentials, signed URL details, and local paths from frozen source summaries. Editor-state tests prevent a publish while any master or placement design remains unsaved.
- A second isolated Workerd run against local R2 returned 400 for a missing expected revision, then 200 for two concurrent publishes of the same revision with the same `publishedAt`. Reopening restored that revision, the anonymous feed returned 200, and the issued PNG returned `miss` then `hit` with identical 17,656-byte content. This proves local runtime bindings and idempotent activation; deployed Netlify/R2 and Meta evidence remain owned by the release stories.

## Impact

Versioned image URLs now carry `assetVersion=2`, so HTTP caches cannot keep serving an incorrect response under a previously issued URL. The stable project feed URL is unchanged. R2 keys use `renders/v2/<project>/<product>/<size>/<template>-<dimensions>-p<productRevision>-t<templateRevision>-r<rendererVersion>.png`; ETags quote the complete key.

Ambiguous `renders/v1/` objects are intentionally never reused: their keys cannot establish which template produced the bytes. Previously issued query shapes still resolve current revisions into the safe namespace, but a superseded asset present only in v1 cannot be safely recovered. Refreshing the stable feed supplies the new image URLs. New cached historical assets use the requested canonical placement dimensions rather than the master's current dimensions.

Product revisions cover all normalized fields that the generic binding path can expose, including `inventory`. Once a v2 URL has stored bytes, removing that product or template in a later publication does not break the old asset: the route reconstructs its exact key from the bounded URL and serves only a cache hit. It never renders new content for a superseded identity.

Every response to `draft=1` uses `private, no-store`, including an anonymous caller's published fallback and error responses. Authenticated versioned draft renders bypass persistent cache reads and writes, preventing unpublished bytes from later becoming public cache hits.

## Next action

Run `c-reliable-workflow-check` across every supported source and coordinate its external evidence with `c-external-render-release`. Netlify is the deployed application path and reaches Cloudflare R2 through the S3-compatible adapter; the external release story owns deployed cache evidence and Worker retirement, while the workflow story owns the supported-source matrix and external Meta acceptance.
