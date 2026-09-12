# Netlify release handoff

Production address: `https://cataloghog.netlify.app`. The owner explicitly chose to retain this address on 2026-09-07. Custom-domain attachment and DNS cutover are deferred; they are not prerequisites for using the current production app.

## Current handoff — September 11

Netlify deploy `6aa303eed8f0140008f61cf6`, commit `622cf2f52bd304498f8ef4285ac0f99410030631`, is `ready` and matches the reviewed checkout. A complete isolated 75-row production run passes feed freshness, anonymous versioned renders, changed/old image behavior, CDN and R2 reuse, query and draft isolation, bounded application failure/recovery, reopen, four exact placement dimensions, and browser inspection. The stable-feed defect is resolved. The [sanitized production artifact](../evidence/external-render-service/netlify-production-2026-09-10.md) contains the reviewable response matrix.

The provider failure criterion now passes against the same production build and R2 adapter in an isolated `next start` process. Unknown feed, render, and template reads returned bounded retryable 503 responses under invalid credentials; an already issued immutable image followed the documented publication-read 503 path and recovered to the same R2 bytes after valid credentials were restored. Shared production credentials and publication records were not changed, and production GET checks retained the same feed and image hashes. The authenticated Netlify dashboard supplied the post-run Free Legacy usage totals and September 10 build consumption; application traffic below its reporting resolution is recorded without inventing a more precise delta.

## Prior handoff — September 8

Worker retirement completed: production and preview access off, Git disconnected, API confirms zero triggers, former hostname returns 403. Owner confirmed all feeds use Netlify; publication review is done locally. The [retirement evidence](../../slices/external-render-service/notes/2026-09-08-worker-retirement.md) supersedes the pending retirement/billing entries below. Current baseline is Netlify deployment `6a9f0dd706a33b0008cf9f48` / commit `53b3bf0`, with post-retirement image verification. Account is Free Legacy.

## Evidence ledger

| Area | Evidence and status |
| --- | --- |
| Current deployment and stable-feed update | Deploy `6aa303eed8f0140008f61cf6` matched commit `622cf2f`. Initial and post-republish feeds returned `public,max-age=0,must-revalidate`, age zero, and a forwarded origin response. The unchanged subscription URL immediately returned a changed CSV and image identity. The earlier cache blocker is resolved. |
| Production feed/image/storage loop | An isolated 75-row CHF/sale CSV saved four placements and published anonymously. New and changed 1080×1080 PNGs returned 200 with different pixels; the prior immutable URL retained its exact 66,776 bytes through an R2 `hit-stale`. Four versioned placement feeds returned exact 1080×1080, 1080×1350, 1080×1920, and 1200×628 PNGs. |
| CDN versus R2 reuse | A new 66,776-byte PNG returned an origin `miss` in 2240 ms. Its exact repeat returned a Netlify Edge hit in 98 ms with identical bytes/ETag. A fresh CDN query variant reached origin and returned `X-Render-Cache: hit` from R2 in 816 ms with the same bytes/ETag. |
| Deployed query and draft isolation | Full-query `Netlify-Vary` was present. Different products returned different bytes; unknown project/template variants returned 404; the draft aggregate returned 401 anonymously. Anonymous draft fallbacks, owner draft feeds, and legacy previews were private/no-store; the authenticated versioned draft returned `bypass-draft`. |
| Browser evidence | Production home and editor views loaded visibly. The editor restored all 75 products, live revision 5, saved state, Republish, stable-feed copy/download controls, four size controls, and the representative long-title output. The browser console had no warnings or errors. |
| Local cache fix checks | Previously passed Next production build, 133 tests, typecheck, lint, story validation and production-mode header checks. These apply to the checked state at that time, not subsequent parallel edits. |
| Versioned-render contract | Product identity includes inventory, historical v2 objects survive product/template removal, and local OpenNext/R2 restart checks passed. The current Netlify run adds production miss/hit/hit-stale, changed-pixel, old-byte, revision, and four-placement evidence. |
| Publication review | Complete. Expected-revision guards, conditional activation, source sanitization, canonical placements, and unsaved-design blocking are covered locally; production adds same-URL update, failed-attempt preservation, recovery, and reopen evidence. |
| Worker retirement / legacy consumers | Completed on 2026-09-08: production and preview access disabled, Git disconnected, zero triggers, no custom domains or routes found, and the former hostname returns 403. Code and R2 remain for recovery/history. |
| Release usage | Authenticated post-run dashboard: Free Legacy; September 87.3 MB bandwidth, ~2.2K web requests, 26/300 build minutes, 989 serverless requests, 324 edge requests and 0.38 GB-hours compute. September 10 shows the two Catalog Forge deployments using three build minutes total. A 30-day pace projects ~262 MB and 78 build minutes; no paid plan is required. |
| Failure recovery | A hosted invalid-template publish returned bounded 422 `INVALID_TEMPLATE`, preserved the live feed, then recovered successfully with 75 rows and matching reopen state. The isolated production build then returned 79–311 ms retryable 503s with invalid R2 credentials; an issued immutable image recovered byte-for-byte as an R2 hit after credential restoration. Shared credentials and publication records remained unchanged. |

## Original delivery checklist (retirement and baseline now completed)

1. Publication review is complete and `c-reliable-publish-project` is done after the current production proof.
2. Current verified deployment and historical rollback references are recorded; only the current deploy has the full publication/cache contract.
3. Worker access is retired and the R2 buckets remain intact. Custom-domain work is deferred.
4. The isolated R2 credential-failure item is complete; review it with the application, cache, browser, and usage evidence before marking the release story done.

The full Reliable Catalog source matrix and manual Meta acceptance remain owned by `c-reliable-workflow-check`. Its authorized Commerce Manager run completed on 2026-09-11 with 30 updated or added products, 0 removed, 0 failed, and 0 issues; see the [sanitized Meta evidence](../evidence/reliable-catalog/meta-import-2026-09-11.md).

## Review handoff

Independent review completed on 2026-09-11 after the owner confirmed the production and Commerce Manager results. All four External Render Service stories are `done`, and the three superseded September 6 investigation notes are resolved. The separate manual Meta acceptance under `c-reliable-workflow-check` is also complete.
