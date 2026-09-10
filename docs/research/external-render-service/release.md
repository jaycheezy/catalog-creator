# Netlify release handoff

Production address: `https://cataloghog.netlify.app`. The owner explicitly chose to retain this address on 2026-09-07. Custom-domain attachment and DNS cutover are deferred; they are not prerequisites for using the current production app.

## Current handoff — September 10

The reviewed checkout was deployed to Netlify as deploy `6aa2fe6d9942ce0008928f2d`, commit `d36c377cef13c5bae80349aaac45e31c2b812349`, and was `ready`. A production verification run successfully reached republish with an isolated 75-row fixture, then exposed a release blocker: the stable project feed retained its prior CSV because its response allowed one hour of shared CDN caching. The local correction requires revalidation for stable `projectId` feeds. See the [production finding](../../slices/external-render-service/notes/2026-09-10-netlify-stable-feed-staleness.md). Redeploy and repeat the matrix before treating any remaining checklist item as closed.

## Prior handoff — September 8

Worker retirement completed: production and preview access off, Git disconnected, API confirms zero triggers, former hostname returns 403. Owner confirmed all feeds use Netlify; publication review is done locally. The [retirement evidence](../../slices/external-render-service/notes/2026-09-08-worker-retirement.md) supersedes the pending retirement/billing entries below. Current baseline is Netlify deployment `6a9f0dd706a33b0008cf9f48` / commit `53b3bf0`, with post-retirement image verification. Account is Free Legacy.

## Evidence ledger

| Area | Evidence and status |
| --- | --- |
| Current deployment and stable-feed update | Deploy `6aa2fe6d9942ce0008928f2d` matched commit `d36c377`. The isolated run passed through successful update publication, but the unchanged public feed URL returned the earlier CSV/image URL. The route's `s-maxage=3600` policy explains the permitted Netlify reuse. A local revalidation-header fix is awaiting deployment and hosted proof. |
| Production feed/image/storage loop | Owner exported CSV through the UI; prior agent reported 31 rows, valid versioned image URLs, a 1080×1080 PNG and matching R2 object. Attribution is retained; this handoff did not repeat that export or R2 download. |
| CDN versus R2 reuse | This task independently observed a durable CDN hit replaying the original miss marker and a fresh CDN variant reaching the R2-hit branch with identical bytes. See the [cache investigation](../../slices/external-render-service/notes/2026-09-07-netlify-cache-query-isolation.md). |
| Deployed query isolation and follow-up cache checks | Owner states the suggested deployment/cache verification is complete. The original blocker is resolved on that confirmation. Raw post-fix headers and deployment identifier were not supplied in this task; do not label them independently captured evidence. |
| Local cache fix checks | Previously passed Next production build, 133 tests, typecheck, lint, story validation and production-mode header checks. These apply to the checked state at that time, not subsequent parallel edits. |
| Current versioned-render changes | “Analyze project priorities” reports inventory included in product revision, exact cached assets surviving product/template removal, and passing tests/builds. It also reports an isolated local OpenNext Worker/R2 miss → hit → restart → hit with identical 18,251-byte PNG and ETag. Local compatibility evidence only; no production deployment implied. |
| Publication review | Owned by “Analyze project priorities”, task `01a06d51-0ccd-7d11-ac97-8fc116d69d09`. Consume its final story handoff before retiring the Worker; no duplicate changes to publication/render code here. |
| Worker retirement / legacy consumers | Read-only Cloudflare API inventory on 2026-09-07: `catalog-forge` workers.dev access is enabled and preview URLs are enabled; Worker custom-domain lookup returned no domains. Zone-level routes and saved feed consumers remain unverified. No access was disabled. |
| Release credit usage | No billing dashboard figures recorded. Record actual account allowance and release consumption; successful caching does not establish zero request/bandwidth cost. |
| Failure recovery and full release matrix | No independent hosted outage/recovery evidence attached here. Do not interpret the owner's cache-check confirmation as completion of unrelated release acceptance. |

## Original delivery checklist (retirement and baseline now completed)

1. Complete the parallel publication review and integrate its handoff. Review hosting against its acceptance criteria; it is in-review, not automatically done.
2. Record the currently live Netlify deployment identifier and a compatible rollback deployment. New local render/versioning changes are a separate deployment decision from the already verified cache fix.
3. Inventory live Worker access and any saved feed consumers. Migrate active consumers before retiring access; leave the R2 buckets intact. Custom-domain work is deferred.
4. Complete the release story's outstanding failure-recovery, billing and reviewable evidence items using the [runbook](runbook.md). Reuse the owner's completed cache checks rather than asking for them again.

The full Reliable Catalog source matrix and manual Meta acceptance remain owned by `c-reliable-workflow-check`. This ledger does not mark that story complete.

## Remaining release work

Deploy the stable-feed revalidation correction, then rerun same-URL republish, old-image survival, four-placement dimensions, hosted failure/recovery, browser evidence, and a release-specific usage delta. Team allowance evidence and projection are recorded in the September 8 note; they do not substitute for a release-run delta. Manual Meta acceptance remains separate.
