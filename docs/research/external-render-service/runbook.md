# Netlify and R2 operations

Use `https://cataloghog.netlify.app` for the app and newly exported feed/image URLs. R2 stores templates/projects/publications in `catalog-forge-templates` and rendered assets in `catalog-forge-renders`. No separate renderer service or custom DNS cutover is required for the current release.

## Coordinate changes

Before deployment or retirement, identify the owner of any active publication/render changes in the shared checkout. Record the reviewed commit and Netlify deployment identifier. Do not deploy an unreviewed shared working tree. “Analyze project priorities” owns publication review; the External Render Service task owns this runbook and retirement/release readiness. Serialize production operations and hand over results explicitly.

## Diagnose a reported image problem

1. Reproduce with a fresh HTTP client using an owner-supplied published URL. Keep the full capability URL, project/product identifiers and raw ETag out of committed evidence.
2. Record status, content type, PNG dimensions, byte count/hash, Cache-Control, Netlify-Vary, Cache-Status, Age and X-Render-Cache. A CDN hit can replay an origin miss marker; do not infer repeated rendering from that marker or latency alone.
3. Confirm effective variation includes all query parameters. Once that configuration is verified, a unique harmless query parameter can request a fresh CDN variant of the same R2 asset. Check that it actually reaches origin using Cache-Status. Before the fix, arbitrary parameters did not bypass the CDN.
4. For an origin storage failure, inspect Netlify function logs around the timestamp/request ID. Verify server-side environment variable presence and scope without printing values: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_TEMPLATES_BUCKET, R2_RENDERS_BUCKET and ADMIN_PASSWORD. CATALOG_FORGE_ALLOW_LOCAL_STORAGE must not enable fallback on the hosted site.
5. Correlate Cloudflare R2 read/write activity with origin requests, not total CDN requests. Preserve existing objects while diagnosing failures.

## Deploy and recover

Use the configured Netlify build from a reviewed revision. Record deploy ID, time and validation results. Confirm query variation survives the deployed Next adapter; local header emission alone is insufficient. Verify old broad cache entries are invalidated when changing cache-key policy; purge remaining CDN entries if necessary.

After deployment, check feed identity, representative products/placements, revision changes and private draft behavior. Separate CDN reuse from origin R2 reuse. Existing browser or Meta caches can retain incorrect immutable responses: refreshing a feed with deliberately changed image URLs may be necessary after correcting a collision. Do not overwrite historical R2 objects to repair client caches.

Rollback to a verified Netlify deployment with correct query variation and compatible R2 identity/publication semantics. Preserve historical assets. A pre-fix Netlify build is not a safe cache rollback, and the Free Worker that exceeded raster CPU limits is not a proven full-service fallback. A renderer change must preserve historical bytes or use the explicit versioning policy owned by the versioned-render story.

## Retired Worker state — September 8

Completed: Worker Git integration disconnected; zero build triggers; production and preview endpoints disabled; no custom domains or zone routes found. Code and R2 remain. The old public hostname returns 403. Wrangler config records both disabled flags. Owner confirmed all consumers use Netlify.

The known-good Netlify baseline is deploy `6a9f0dd706a33b0008cf9f48` (commit `53b3bf0`). Do not choose the older completed deploys: they lack query isolation. Verify storage backward compatibility before rolling future publication changes back to this baseline. Reconnecting Worker Git requires explicitly restoring the original repository/build settings recorded in the retirement note; enabling public URLs also requires an explicit configuration change.

## Worker retirement procedure (completed)

Inventory deployed Worker routes, workers.dev and preview access, plus known saved feed consumers; record sanitized identifiers and recent traffic evidence. The absence of routes in local wrangler configuration does not prove the deployment is unused.

For active consumers, migrate their configured feed URLs or establish a reviewed redirect preserving query parameters before retirement. Verify delivery from Netlify and ensure a viable rollback exists. Disable obsolete Worker entry points only once the inventory is resolved; record the exact action and verify they no longer serve the old app. Retain Cloudflare R2 buckets and deployment configuration. Never delete storage as part of Worker retirement.

## Credentials and cost

Observed account: Free Legacy, 100 GB bandwidth and 300 build minutes. September 8 team totals: 87.3 MB bandwidth, 18 build minutes, 2.2K web requests, 989 serverless requests and 324 edge requests. These are team aggregates, not release-specific figures. Re-read the dashboard each release; the 300-credit model does not apply to this account.

For rotation, create replacement R2 credentials limited to the required buckets, update Netlify's server-side environment, deploy and verify reads/writes before revoking the old credentials. Keep values out of source, browser bundles and logs. Changing the admin password is a separate owner-access operation.

Read the Netlify account's actual plan and credit dashboard; record allowance, current usage, reset period and release-run consumption with timestamps. Break down deploy, compute, requests and bandwidth where available. Review R2 usage independently. A CDN/R2 hit avoids raster work but does not imply free delivery. Record an observed usage projection and available alerts without enabling paid upgrades or automatic spend.

## Failure verification

Use isolated fixtures/environment for bad credentials and missing storage; never disable shared production credentials for a test. Cover new-key misses, existing R2 assets and already cached CDN responses separately. A CDN hit during an outage proves CDN availability, not R2 health. Origin may still require publication reads before serving a stored asset. Record actual sanitized error/status/retry behavior, preserve the previous published feed and recover credentials before completing the exercise.

Keep the evidence ledger in [release.md](release.md) current. Mark release complete only when the owning story's remaining acceptance evidence is reviewable.
