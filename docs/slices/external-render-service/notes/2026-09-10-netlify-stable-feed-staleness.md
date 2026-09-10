---
id: netlify-stable-feed-staleness
title: Stable project feeds stay stale after republish on Netlify
type: blocker
status: open
author: Codex
updated: "2026-09-10"
affects: [c-external-render-release, c-reliable-publish-project, c-reliable-workflow-check]
---

## Summary

Production verification found that a successful republish did not immediately update the stable anonymous project feed. The feed route advertised `public, s-maxage=3600, stale-while-revalidate=600`, so Netlify was allowed to reuse the previous CSV after the publication record had advanced. The stale CSV continued to point at the old immutable image URL. This violates the publication contract even though the new snapshot and image identity were written correctly.

The local correction makes published `projectId` feeds return `public, max-age=0, must-revalidate`. Legacy domain/store feeds keep their one-hour shared cache, draft responses remain `private, no-store`, and versioned PNGs retain immutable caching. The blocker stays open until this correction is deployed and the same stable URL returns the new CSV immediately after republish.

## Evidence

The 2026-09-10 run targeted `https://cataloghog.netlify.app`, Netlify deploy `6aa2fe6d9942ce0008928f2d`, commit `d36c377cef13c5bae80349aaac45e31c2b812349`, state `ready`. The deploy commit matched the clean reviewed checkout before the run.

An isolated synthetic project imported 75 CSV rows with CHF prices and a sale price, saved all four placement templates, and published 75 rows. Before the failure, the harness passed anonymous feed, distinct-product render, repeated-byte/ETag, origin R2 reuse, all-query variation, unknown-project/template isolation, private-project rejection, anonymous-draft cache, draft invisibility, update-save, and update-publish assertions. The second fetch of the unchanged feed URL then returned the original image URL and stopped the run at the changed-image assertion.

The runner terminated before writing its final structured evidence bundle, so no exact cache headers, timing claims, placement-dimension results, recovery result, or release usage delta are attributed to this run. The fixture uses synthetic data and an unguessable capability ID; the ID and URLs are not retained in the repository. The project remains in production because there is no delete interface.

[Netlify's dynamic response caching documentation](https://docs.netlify.com/build/caching/caching-overview/) states that `s-maxage` permits reuse in its shared cache and shows `public, max-age=0, must-revalidate` as the default non-stale policy for dynamic responses. The local Next.js CDN guide also warns that a CDN continues serving an `s-maxage` response until its TTL expires unless it is purged.

## Impact

A merchant can republish successfully while Meta and other anonymous consumers continue reading the previous catalog for up to an hour, with a possible stale-while-revalidate window after that. The immutable image behavior is correct, but consumers cannot discover the new image identities until the stable CSV refreshes. Production release sign-off and the publish story's same-URL update criterion therefore remain open.

## Regression

The public route tests pin both branches: stable published project feeds must revalidate on every request, while legacy store feeds retain their existing shared-cache policy. The republish regression now asserts that the unchanged subscription URL carries the revalidation header before and after its CSV and immutable image URL change. Focused validation passes: 3 files / 28 tests. The full gate also passes: story map 50 stories across 6 slices with 14 notes, 23 files / 152 tests, typecheck, lint without warnings, Next production build with 97 static paths, OpenNext/Cloudflare compatibility build, and clean diff whitespace.

## Next action

Deploy the correction, confirm the public response header, then rerun the isolated production matrix. Record the new deploy identifier, same-URL republish result, new and old PNG evidence, all four dimensions, bounded failure/recovery, browser observations, and the release-specific Netlify usage delta before resolving this note or promoting the release story.
