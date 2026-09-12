# Netlify production verification — 2026-09-10

Production host: `https://cataloghog.netlify.app`

Deploy: `6aa303eed8f0140008f61cf6`

Commit: `622cf2f52bd304498f8ef4285ac0f99410030631`

Deploy state: `ready`

Published: 2026-09-10 19:25:46 UTC

This artifact records sanitized production results. Capability IDs, cookies, credentials, complete feed/render URLs, and raw ETags are omitted. Synthetic fixtures used an unguessable project ID and public placeholder artwork. They remain in R2 because the application has no delete interface.

## Published journey

The final isolated run completed in 39 seconds. It authenticated, imported a 75-row CSV, saved four placements, published, fetched anonymously, saved a visible blue-title update, republished through the unchanged subscription URL, exercised a rejected update, recovered, reopened, and rendered every placement. The catalog retained `19.90 CHF` prices and a `15.50 CHF` sale price. Validation reported `needs-review` with zero errors because the synthetic image source cannot supply the catalog validator with dimensions.

| Check | Production result |
| --- | --- |
| Create/import | 200; complete; 75 rows |
| Save all placements | 200; four placements |
| First publish | 200; 75 published rows |
| Anonymous stable feed | 200; 75 rows; all-query `Netlify-Vary` |
| Draft save before republish | Anonymous feed remained byte-for-byte unchanged |
| Republish | 200; subscription URL unchanged; CSV and versioned image URL changed immediately |
| Invalid-template publish | 422 `INVALID_TEMPLATE`; prior live feed unchanged |
| Recovery publish/reopen | 200; 75 live rows; reopened draft revision matched the active publication |
| Isolation | Distinct product bytes; unknown project/template 404; project aggregate 401 anonymously |

## Stable-feed freshness

Both the initial and post-republish responses returned `Cache-Control: public,max-age=0,must-revalidate`, `Age: 0`, and full-query variation. The first response was forwarded with a cache bypass. The post-republish request reported a stale edge entry and forwarded it to origin; the returned body and immutable image URL were the new publication. This closes the defect where the earlier one-hour `s-maxage` served the previous CSV without revalidation.

## CDN and R2 cache evidence

One new 1080×1080 versioned image exercised all three layers. Hash and ETag values below are non-reversible prefixes.

| Request | Status/time | Cache evidence | Bytes/dimensions | Hash prefix |
| --- | --- | --- | --- | --- |
| New object | 200 / 2240 ms | Netlify vary miss; `X-Render-Cache: miss` | 66,776 / 1080×1080 | `4755711b11477d37` |
| Exact repeat | 200 / 98 ms | Netlify Edge hit; replayed origin `miss` marker | 66,776 / 1080×1080 | `4755711b11477d37` |
| Fresh CDN query variant | 200 / 816 ms | Netlify vary miss; origin `X-Render-Cache: hit` from R2 | 66,776 / 1080×1080 | `4755711b11477d37` |

All three responses had identical bytes and ETags and advertised `public,max-age=31536000,immutable`. The changed design produced a 66,997-byte PNG with a different image URL, ETag prefix, byte hash `8427caf55787ec6b`, and visible pixels. Fetching the old URL through a fresh CDN query reached `X-Render-Cache: hit-stale` and returned the original 66,776 bytes.

## Placement and draft branches

Each placement was requested through its own stable feed variant. Every feed returned 75 rows with the non-stale project-feed policy, and every issued image URL included product, template, size, and revision identity. The versioned images were immutable R2 hits with distinct ETags and bytes.

| Placement | Status | Expected | Actual | Bytes | Hash prefix |
| --- | --- | --- | --- | --- | --- |
| `1:1` | 200 | 1080×1080 | 1080×1080 | 67,335 | `68ff172951a93556` |
| `4:5` | 200 | 1080×1350 | 1080×1350 | 74,008 | `5fe373b089d4b858` |
| `9:16` | 200 | 1080×1920 | 1080×1920 | 88,955 | `a909cbd270156961` |
| `1.91:1` | 200 | 1200×628 | 1200×628 | 56,977 | `92bc27021c44b280` |

Anonymous `draft=1` feed/image requests fell back to published truth and remained `private,no-store`. The authenticated draft feed and legacy preview image were also `private,no-store`. An authenticated versioned draft image returned `X-Render-Cache: bypass-draft`, proving the mutable draft branch did not read or write the persistent render cache.

## Browser observation

The deployed home page visibly loaded its live catalog preview and exposed Store URL, Feed URL, CSV, validation, template, and placement controls. The production editor then reopened the synthetic project with the CSV source, all 75 products, the blue-title render, `Saved ✓`, live revision 5, Republish, Copy Published Feed URL, Download CSV, and all four size selectors. The 1080×1080 output visibly wrapped the long title without clipping and kept the price badge inside the canvas. Browser console capture contained no warnings or errors. Capability values visible during the browser run are omitted here.

## Netlify usage

The authenticated dashboard still identifies the team as Free Legacy. After the run, its loaded September totals were 87.3 MB bandwidth, approximately 2.2K web requests, 26 of 300 build minutes, 989 serverless requests, 324 edge requests, and 0.38 GB-hours of serverless compute. September 10 showed two Catalog Forge builds consuming three minutes total; these are the pre-fix and corrected deployments used by this verification. Compared with the September 8 baseline, the detailed bandwidth/request/function totals had no visible change at the dashboard's current resolution, while team build usage rose from 18 to 26 minutes as later builds were incorporated. The dashboard reports team totals and updates asynchronously, so sub-resolution application traffic is not presented as a precise per-run delta.

At the current September pace, a simple 30-day projection is about 262 MB bandwidth, 78 build minutes, 3K serverless requests, 972 edge requests, and 1.14 GB-hours compute. The two displayed allowances remain 100 GB bandwidth and 300 build minutes; this projection uses less than 1% of bandwidth and 26% of build minutes. No paid plan, upgrade, payment method, or billing change was required.

## Isolated R2 credential failure — 2026-09-11

The remaining provider failure check used the same production build and S3-compatible R2 adapter under `next start`, with production fallback disabled. Only the isolated process received deliberately invalid access credentials; the shared Netlify environment, publication records, and existing immutable objects were not changed. A normal production GET primed the issued render key before the outage probe.

| Probe | Invalid-credential result | Restored result |
| --- | --- | --- |
| Unknown published feed | 503 in 79 ms; response instructed the caller to retry | 404 in 177 ms; normal unpublished response |
| Unknown versioned render | 503 in 311 ms; response instructed the caller to retry | 404 in 541 ms; normal unpublished response |
| Unknown template | 503 in 115 ms; `DURABLE_STORAGE_FAILED`, `retryable: true` | 404 in 164 ms; normal not-found response |
| Already issued immutable image | Exact path returned 503 in 208 ms before cache access because the route could not read its publication | 200 R2 hit in 828 ms; 1,246,266 bytes; hash `98505fbcfcdb9e68` |

Before failure injection, the issued image returned a 200 R2 hit with the same 1,246,266 bytes and hash. The restored response therefore recovered byte-for-byte without rasterization or object replacement. This records the route's specified cached-key behavior when publication storage is unavailable; it does not mislabel that origin 503 as a CDN result.

The feed and render publication-read 503 responses do not currently include a `Retry-After` header; their retry guidance is the 503 status plus response copy. The template JSON additionally exposes `retryable: true`. This is recorded for review rather than inferred from a deeper render-cache branch that the request cannot reach while publication storage is unavailable.

A separate production GET check before and after the isolated sequence returned the same 30-row feed body (26,745 bytes, hash `2f377227ca052c2d`) and the same image bytes/hash. The final image request was a Netlify Durable Cache hit. The provider failure criterion is now reviewable without exposing capability URLs or altering shared credentials. Manual Meta import remains owned by the Reliable Catalog workflow story.

One post-fix fixture reached successful recovery before the verifier stopped on an overly strict expectation that a recovery save could not advance immutable identity; the corrected final fixture completed. This was a verifier correction, not a product failure. Both fixtures contain synthetic data and remain isolated by unguessable capabilities.
