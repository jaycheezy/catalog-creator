---
id: netlify-stable-feed-staleness
title: Stable project feeds stay stale after republish on Netlify
type: blocker
status: resolved
author: Codex
updated: "2026-09-10"
affects: [c-external-render-release, c-reliable-publish-project, c-reliable-workflow-check]
---

## Summary

Production verification found that a successful republish did not immediately update the stable anonymous project feed. The feed route advertised `public, s-maxage=3600, stale-while-revalidate=600`, so Netlify was allowed to reuse the previous CSV after the publication record had advanced. The stale CSV continued to point at the old immutable image URL. This violates the publication contract even though the new snapshot and image identity were written correctly.

Resolved on deploy `6aa303eed8f0140008f61cf6`: published `projectId` feeds now return `public, max-age=0, must-revalidate`. Legacy domain/store feeds keep their one-hour shared cache, draft responses remain `private, no-store`, and versioned PNGs retain immutable caching. The same production subscription URL returned the newly published CSV and image URL immediately after republish.

## Evidence

The 2026-09-10 run targeted `https://cataloghog.netlify.app`, Netlify deploy `6aa2fe6d9942ce0008928f2d`, commit `d36c377cef13c5bae80349aaac45e31c2b812349`, state `ready`. The deploy commit matched the clean reviewed checkout before the run.

An isolated synthetic project imported 75 CSV rows with CHF prices and a sale price, saved all four placement templates, and published 75 rows. Before the failure, the harness passed anonymous feed, distinct-product render, repeated-byte/ETag, origin R2 reuse, all-query variation, unknown-project/template isolation, private-project rejection, anonymous-draft cache, draft invisibility, update-save, and update-publish assertions. The second fetch of the unchanged feed URL then returned the original image URL and stopped the run at the changed-image assertion.

The runner terminated before writing its final structured evidence bundle, so no exact cache headers, timing claims, placement-dimension results, recovery result, or release usage delta are attributed to this run. The fixture uses synthetic data and an unguessable capability ID; the ID and URLs are not retained in the repository. The project remains in production because there is no delete interface.

[Netlify's dynamic response caching documentation](https://docs.netlify.com/build/caching/caching-overview/) states that `s-maxage` permits reuse in its shared cache and shows `public, max-age=0, must-revalidate` as the default non-stale policy for dynamic responses. The local Next.js CDN guide also warns that a CDN continues serving an `s-maxage` response until its TTL expires unless it is purged.

The corrected deploy matched commit `622cf2f52bd304498f8ef4285ac0f99410030631`. A new isolated 75-row production run returned `Age: 0` with the revalidation policy both before and after republish. The post-update request forwarded the stale edge entry to origin and returned a changed CSV body plus a changed versioned image URL. The new PNG pixels changed, while a fresh request for the prior URL returned its original bytes through `X-Render-Cache: hit-stale`. See the [sanitized production evidence](../../../research/evidence/external-render-service/netlify-production-2026-09-10.md).

## Impact

The defective deploy could leave Meta and other anonymous consumers on the previous catalog for up to an hour. The corrected deployment revalidates the stable feed at origin while keeping the versioned images immutable, so consumers discover new image identities without changing their subscription URL. The publish story's same-URL production criterion is now satisfied.

## Regression

The public route tests pin both branches: stable published project feeds must revalidate on every request, while legacy store feeds retain their existing shared-cache policy. The republish regression now asserts that the unchanged subscription URL carries the revalidation header before and after its CSV and immutable image URL change. Focused validation passes: 3 files / 28 tests. The full gate also passes: story map 50 stories across 6 slices with 14 notes, 23 files / 152 tests, typecheck, lint without warnings, Next production build with 97 static paths, OpenNext/Cloudflare compatibility build, and clean diff whitespace.

## Next action

Keep the revalidation assertion in the public-route regression and the same-URL check in future Netlify smoke runs. The separate release usage and isolated R2 credential checks are now attached to the release evidence; neither changes this resolved cache finding.
