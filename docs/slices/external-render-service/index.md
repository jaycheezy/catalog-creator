---
id: "external-render-service"
title: "External Render Service — production PNGs on Netlify"
description: "Host the Next app on Netlify free while storage and DNS stay on Cloudflare; rasterization happens in-route"
order: 5
tone: "amber"
---

# External Render Service — production PNGs on Netlify

## Outcome

A merchant can publish a catalog from the Netlify free deployment and Meta can fetch branded PNGs reliably. Netlify serves the application, feed, and image routes; Cloudflare keeps DNS, R2 buckets, and stored assets. No separate renderer service exists; native ImageResponse rendering has been verified on Netlify.

Example: a published Gibun project emits a versioned image URL. Meta requests it anonymously, the Netlify function validates the publication and revisions, renders on a cache miss, stores the PNG in `RENDERS_BUCKET` over the S3-compatible R2 API, and returns it. A repeat request can be served by Netlify’s CDN or, when it reaches the function, by R2 without re-rasterization.

## Scope

This slice owns the Netlify hosting decision, the R2 S3-compatibility seam, traffic cutover with Worker retirement, and end-to-end production evidence. It preserves the existing `CatalogProject`, publication snapshot, versioned render URL, product revision, template revision, placement, and R2 object-key contracts. It does not add scheduled synchronization, change the editor design model, expose R2 credentials to browsers, or make an external Meta API submission.

## Current evidence

The resolved [Free-plan blocker](notes/2026-09-06-free-plan-renderer-blocker.md) records the deployed `exceededCpu` failure that removed Worker-side rasterization from consideration. The resolved [spike PoC proposal](notes/2026-09-06-renderer-spike-poc.md) proves the native route on a production Node build and records Netlify as the selected host with Cloud Run as fallback. The owner then simplified the architecture by moving the complete Next application to Netlify rather than adding a separate renderer service.

The [cache-isolation blocker](notes/2026-09-07-netlify-cache-query-isolation.md) and [stable-feed blocker](notes/2026-09-10-netlify-stable-feed-staleness.md) are resolved on the reviewed production deployment. The final evidence covers all-query isolation, immediate feed freshness, four placement dimensions, anonymous versioned images, CDN and origin R2 reuse, historical assets, private drafts, bounded failure/recovery, browser operation, Free Legacy usage, and an external Meta import with no failed rows or issues. The selected production address remains `cataloghog.netlify.app`; custom-domain work is deferred.

## Shared architecture and contracts

These are implementation constraints. Proposed file names below establish ownership and may be adjusted in a story handoff without changing the boundary.

| Owner | Responsibility |
| --- | --- |
| Spike | Proved Node feasibility, dated costs, and the renderer parity/version policy in a decision note. Done as input; residual gates are deployment-side. |
| Hosting | Netlify build/deploy configuration, isolated S3-compatible R2 seam, input validation, secret handling, and render smoke tests. Own a runtime-neutral store contract in the existing `src/lib` store modules; never import Cloudflare bindings or credentials outside that seam. |
| Cutover | Keep the Netlify subdomain, inventory legacy consumers, retire the Worker, and document a verified Netlify rollback. Custom-domain work is deferred. Preserve the shared editor projection and all public URL semantics. |
| Release | Sanitized evidence and operational runbook under `docs/research/external-render-service/`; verify the deployment and link the Reliable Catalog workflow proof. |

### Hosting and execution budgets

Rasterization runs inside the Netlify function that serves `/api/render`. Local benchmarks are distinct from provider budgets. Canonical dimensions are enforced; PNG/input/retrieval bounds require verification against the actual implementation and must not be assumed from the spike. Use the existing per-IP rate limiter as best-effort only; it is per-instance, not a global render-cost cap. CDN and R2 reuse reduce repeated rasterization; misses, concurrency and failed storage can still cause additional work. Missing R2 configuration fails closed with the existing retryable 503s, never with silent local fallbacks in production.

### Public route and cache policy

All API responses must use `Netlify-Vary: query` so catalog identity and draft flags participate in CDN cache keys. Preserve framework variations and route Cache-Control policies. Inspect effective deployed headers and invalidate old broad cache entries when introducing this configuration. Distinguish CDN hits (`Cache-Status`, `Age`) from origin R2 results (`X-Render-Cache`), which CDN hits can replay unchanged.

| Path | Required behavior |
| --- | --- |
| Published versioned hit / cached historical revision | Return existing R2 bytes and ETag with no re-rasterization, even if R2 credentials are only readable. Preserve the cached square-after-portrait regression. |
| Published current versioned miss | Validate publication, exact product/template and requested revisions, rasterize in-route, verify bounded PNG bytes, signature and IHDR dimensions, then store. Only successful storage gets immutable headers. |
| Valid PNG but R2 put fails | Preserve existing `200` short-cache policy and `X-Render-Cache: miss-write-failed`; do not claim an immutable asset was persisted. |
| Authenticated draft, versioned or unversioned | Render the selected saved draft in-route, bypass R2 reads/writes, and return `private, no-store`. Every `draft=1` response remains private, including anonymous fallback and errors. Never expose draft bytes through a later stale public lookup. |
| Unversioned published project | Select the active publication and rasterize in-route with the existing shorter cache policy. |
| Legacy domain/template or inline template | Preserve current lookup/selection behavior and public capability semantics with in-route rasterization. Invalid/unsupported designs fail explicitly. |

Keep existing public 400/404/409 and rate-limit 429 behavior. R2 outage or invalid credentials become sanitized retryable failures; invalid upstream PNGs are never cached. Owner input outside the supported contract returns 422. Every failure is `no-store`. Logs omit payloads, image query strings, secrets and capability IDs.

### Pixels, versioning and image retrieval

Reuse `renderTemplateElement`, `renderStyles`, `bindings`, `types`, bundled `interFonts`, and the existing native `ImageResponse` implementation. Pin Next, font and runtime versions. Parity uses identical captured image bytes and decoded RGBA output across the four placements, long/wrapped text, sale prices, rotation and missing-image fixtures. Require exact decoded pixels for retaining renderer version 1; byte encodings may differ only under a documented policy that preserves stored assets. Current URLs carry `assetVersion=2`; never overwrite old keys or read ambiguous `renders/v1/` objects.

An empty image URL preserves the existing deterministic missing-image block. A nonempty URL that fails retrieval/decoding produces a retryable error, never a permanently cached failure placeholder. Image bytes must stay stable within the job. Current product revisions hash the image URL, not its bytes: cross-time determinism at mutable upstream URLs is not established. Persistent image snapshots/content hashes are separate follow-up work if required, not an implicit guarantee here.

## Delivery order

1. `c-external-render-spike` proved feasibility and froze the hosting recommendation.
2. `c-external-render-service` implements Netlify hosting with the R2 S3-compatibility seam.
3. `c-external-render-adapter` cuts traffic over, verifies the new host, and retires the Worker.
4. `c-external-render-release` proves local, Netlify, cache-hit, failure, credit, and representative Meta-fetch behavior.

All four stories are complete after independent review of the spike, hosting, Worker retirement, and production release evidence. See the [release handoff](../../research/external-render-service/release.md).

## Release evidence

The slice is complete when a fresh versioned production render returns `200 image/png` on a cache miss, a repeat returns the same bytes and ETag from R2 without re-rasterization, uncached stale revisions still return `409` while already cached historical assets remain retrievable, R2/credential failures are actionable, Actual-plan Netlify usage is recorded against the free allowance, and the published feed contains usable anonymous image URLs. Evidence must include Netlify deploy identifiers and function logs, R2 object evidence, and redacted response metadata.

The evidence must also show all three formerly Worker-inline raster paths rasterizing in-route on Netlify, bounded failure behavior, and timings for misses and hits at the recorded catalog size. A build alone is insufficient. Reuse this evidence from `c-reliable-workflow-check`; that story retains the four-source merchant journey and manual Meta import requirement.

## September 11 closure

Independent review accepted the complete evidence bundle. Netlify is the sole production application host, the former Worker remains disabled, R2 data is retained, the operational runbook is current, and the external Meta acceptance succeeded. Every story in this slice is `done`; future work belongs in a new slice or a newly recorded production finding.

## September 8 handoff

Publication review completed in the parallel task. The old Worker is now retired (public/preview URLs off, Git triggers removed), with R2 and code preserved. Retirement is in-review. Netlify deployment `6a9f0dd706a33b0008cf9f48` remains the verified baseline; earlier builds lack the cache fix. This account uses Free Legacy allowances, not credit pricing. See [retirement and usage evidence](notes/2026-09-08-worker-retirement.md). Final release recovery evidence remains outstanding.
