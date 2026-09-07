---
id: "external-render-service"
title: "External Render Service — production PNGs on Netlify"
description: "Host the Next app on Netlify free while storage and DNS stay on Cloudflare; rasterization happens in-route"
order: 5
tone: "amber"
---

# External Render Service — production PNGs on Netlify

## Outcome

A merchant can publish a catalog from the Netlify free deployment and Meta can fetch branded PNGs reliably. Netlify serves the application, feed, and image routes; Cloudflare keeps DNS, R2 buckets, and stored assets. No separate renderer service exists: the 10 s Netlify function timeout covers the measured ~1 s native `ImageResponse` renders.

Example: a published Gibun project emits a versioned image URL. Meta requests it anonymously, the Netlify function validates the publication and revisions, renders on a cache miss, stores the PNG in `RENDERS_BUCKET` over the S3-compatible R2 API, and returns it. A repeat request can be served by Netlify’s CDN or, when it reaches the function, by R2 without re-rasterization.

## Scope

This slice owns the Netlify hosting decision, the R2 S3-compatibility seam, traffic cutover with Worker retirement, and end-to-end production evidence. It preserves the existing `CatalogProject`, publication snapshot, versioned render URL, product revision, template revision, placement, and R2 object-key contracts. It does not add scheduled synchronization, change the editor design model, expose R2 credentials to browsers, or make an external Meta API submission.

## Current evidence

The [Free-plan blocker](notes/2026-09-06-free-plan-renderer-blocker.md) records a deployed `exceededCpu` failure for Worker-side rasterization, which the hosting decision accepts as final for the Worker. The [spike PoC proposal](notes/2026-09-06-renderer-spike-poc.md) proves the native route unmodified on a production Node build (cold miss 545 ms, steady misses 89–435 ms, warm-hit p95 2.7 ms, exact PNG dimensions on all four placements, byte-identical refetches) and recommends Netlify Free as primary host with Cloud Run free as fallback. A Netlify-hosting decision by the owner superseded the separate-renderer direction; the old service/adapter split below is replaced by host, cutover, and release stories.

Production follow-up on 2026-09-07 verified CDN reuse and an origin R2 hit, but found that Netlify ignores catalog query parameters and returns the square PNG for a portrait request. The [cache-isolation blocker](notes/2026-09-07-netlify-cache-query-isolation.md) records evidence, the local configuration fix, and required deployment checks. Hosting is in-progress; release and cutover remain blocked.

## Shared architecture and contracts

These are implementation constraints. Proposed file names below establish ownership and may be adjusted in a story handoff without changing the boundary.

| Owner | Responsibility |
| --- | --- |
| Spike | Proved Node feasibility, dated costs, and the renderer parity/version policy in a decision note. Done as input; residual gates are deployment-side. |
| Hosting | Netlify build/deploy configuration, isolated S3-compatible R2 seam, input validation, secret handling, and render smoke tests. Own a runtime-neutral store contract in the existing `src/lib` store modules; never import Cloudflare bindings or credentials outside that seam. |
| Cutover | DNS/domain configuration, production verification on the new host, Worker retirement, and rollback documentation. Preserve the shared editor projection and all public URL semantics. |
| Release | Sanitized evidence and operational runbook under `docs/research/external-render-service/`; verify the deployment and link the Reliable Catalog workflow proof. |

### Hosting and execution budgets

Rasterization runs inside the Netlify function that serves `/api/render`: measured steady misses of 89–435 ms sit an order of magnitude under the 10 s free function timeout. Keep every render input bounded as today (canonical four dimensions, 100-layer discipline, 8 MiB PNG ceiling, bounded product-image retrieval). Use the existing per-IP rate limiter as best-effort only; it is per-instance, not a global render-cost cap. R2 absorbs repeat Meta fetches so renderer traffic equals the catalog-change rate. Missing R2 configuration fails closed with the existing retryable 503s, never with silent local fallbacks in production.

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

Hosting implementation is in-progress with a production query-isolation blocker; adapter and release remain proposed until their prerequisites are reviewed. Release proof depends on both implementation stories.

## Release evidence

The slice is complete when a fresh versioned production render returns `200 image/png` on a cache miss, a repeat returns the same bytes and ETag from R2 without re-rasterization, uncached stale revisions still return `409` while already cached historical assets remain retrievable, R2/credential failures are actionable, Netlify credit consumption is recorded against the free allowance, and the published feed contains usable anonymous image URLs. Evidence must include Netlify deploy identifiers and function logs, R2 object evidence, and redacted response metadata.

The evidence must also show all three formerly Worker-inline raster paths rasterizing in-route on Netlify, bounded failure behavior, and timings for misses and hits at the recorded catalog size. A build alone is insufficient. Reuse this evidence from `c-reliable-workflow-check`; that story retains the four-source merchant journey and manual Meta import requirement.
