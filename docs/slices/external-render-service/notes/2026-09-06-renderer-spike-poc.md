---
id: external-renderer-spike-poc
title: Native Next renderer proven on Node; Netlify Free primary, Cloud Run fallback
type: proposal
status: open
author: Muse Spark
updated: "2026-09-06"
story: c-external-render-spike
affects:
  - c-external-render-service
  - c-external-render-adapter
  - c-external-render-release
---

## Summary

The existing native Next `ImageResponse` route runs unmodified on a production Node build and meets every raster gate, so no custom rasterizer is needed. Free-plan Cloudflare cannot rasterize (measured 1552 ms CPU vs the 10 ms Free budget, 155× over, with no free knob), but it remains viable as the auth/feed/R2 front door. Recommended primary renderer host: Netlify Free ($0, commercial use allowed, no card, 10 s function timeout against ~1 s measured renders). Fallback: Google Cloud Run free tier. Vercel Hobby is explicitly rejected for production (non-commercial ban). A $5 Workers Paid plan would fix this with zero architecture change and is the honest stay-on-Cloudflare alternative.

## Evidence

Classified local proof-of-concept, 2026-09-06, against a production `next start` build with a fixture project (2 products: embedded data-URI PNG plus remote Shopify CDN GIF; 4 placement templates with rotation, opacity, borders, shadows, sale badge) seeded to the `/tmp` dev stores with `CATALOG_FORGE_ALLOW_LOCAL_STORAGE=true`. Repro: `node scripts/poc-render-fixture.mjs`, start the production server, `GET /api/feed?projectId=…&templateId=…`, then `GET` each issued render URL. Fixture removed after the run; dev stores restored byte-for-byte.

- Cold process first render (1:1): HTTP 200 in 545 ms, 66,854 bytes, `X-Render-Cache: miss`, immutable headers, quoted-key ETag.
- Steady misses after restart (8 URLs, 4 placements × 2 products): 89–435 ms; remote-image rows cost more (~155–203 ms vs ~89–110 ms embedded). No failures.
- Warm hits (80 samples): p50 1.8 ms, p95 2.7 ms, max 5.2 ms.
- Burst of 6 concurrent misses: all HTTP 200 in 0.52–0.71 s each, 0.76 s wall — parallel, not serialized.
- PNG validity: correct signature and exact IHDR dimensions for all four placements (1080×1080, 1080×1350, 1080×1920, 1200×628); 39,698–84,135 bytes, far under the 8 MiB budget. Refetch byte-identical 8/8.
- Remote Shopify CDN GIF decodes through Satori on Node (isolated probe, SVG length 4221). Feed CSV 833 bytes; render URLs ~200 chars.

Free-plan gates, dated September 2026:

- Raster CPU impossibility: production `exceededCpu` at 1552 ms (blocker note) vs 10 ms Free HTTP budget per current Cloudflare limits docs. No free upgrade path; `limits.cpu_ms` is rejected on Free (code 100328, blocker note).
- Bundle: `wrangler deploy --dry-run` reports 10.5 MiB total, 2.56 MiB gzip vs the 3 MiB compressed Free limit — fits with ~15% headroom. No deployment was published. Font/dependency growth can break this gate; watch it.
- Hit path: 250-row publication parse plus one product hash measures ~0.5 ms median on laptop Node — directionally fits 10 ms on workerd, but only a deployed measurement counts (open gate below).
- R2 works on the Free plan with a free tier of 10 GB-months plus 1M Class A and 10M Class B operations; Gibun scale (31 products × 4 placements ≈ 124 puts per redesign, ~7 MB stored) is noise level. R2 absorbs Meta refetches so renderer traffic equals the catalog-change rate, not the fetch rate.

Provider comparison, September 2026 documentation:

- Netlify Free: commercial projects allowed, no card, hard caps (suspension, never surprise bills), 125 k function invocations and 100 GB bandwidth per month, 10 s function timeout. A 0.1–0.7 s render fits with an order of magnitude to spare; 100 k uncached jobs/month fits invocations and roughly 28 compute credits of the 300 free. Native Next.js support. Primary.
- Vercel Hobby: technically ideal (Next-native, 300 s duration, 1 M invocations, 4 CPU-hours) but the plan bans commercial use, which disqualifies merchant catalog production; ~50 k+ uncached renders/month would also exceed its CPU allowance. Rejected for production; acceptable for non-commercial dev only.
- Render Free: sleeps on idle, so first Meta fetches after quiet periods would fail catalog imports. Rejected for the Meta-facing path.
- Google Cloud Run free tier (2 M requests, 360 k GB-seconds monthly): generous $0 headroom and commercial OK. Fallback if Netlify proves unsuitable; costs a GCP account with billing details.
- Workers Paid at $5/month: 30 s default CPU covers the measured 1552 ms with the current code unchanged (memory already proven in production). Cheapest if staying on Cloudflare outweighs $0.

Zero-new-service options evaluated per the no-new-service preference:

- Publish-time browser pre-render (merchant tab rasterizes, PUTs to R2): $0 and zero infrastructure, and Shopify CDN sends `Access-Control-Allow-Origin: *` (measured 2026-09-06), but 250 products × 4 placements at ~1–2 s each keeps a tab busy 15–30+ minutes, non-CORS hosts taint the canvas, and there are no background retries. Viable for small CORS-clean catalogs only; not the primary.
- Queues/Cron pre-render on the Worker: same 10 ms CPU wall. Dead end.

Cost model: 1 k uncached jobs/month is $0 everywhere. 100 k/month fits Netlify Free and Cloud Run free, fails Hobby (cap, CPU, commercial ban). Realistic Gibun traffic (a few hundred renders per redesign, R2 absorbing refetches) fits every candidate with large headroom.

Incidental finding (not a PoC blocker): a hand-rolled publication record missing `projectId` crashes the render route with a TypeError 500. Real records always carry it via `buildPublicationSnapshot`, but the adapter may want a corrupt-record guard.

## Impact

The native-route-first strategy is proven; the custom-rasterizer fallback is not needed unless Netlify and Cloud Run both fail deployment. The Worker keeps auth, feed, publication, R2, and immutable URL semantics on the Free plan; only cache-miss rasterization moves. Frozen service contract for implementation: `POST /v1/render` with `{ schemaVersion: 1, rendererVersion, requestId, template, product, width, height }` over HTTPS with a deployment-injected Bearer secret; template is the complete selected design, product is one normalized row, no storage/project/cookie access; budgets per the slice index (1 MiB JSON, 100 layers, canonical four dimensions, 8 MiB PNG, 5 MiB source image, 16 MP decode cap, 5 s retrieval, 12 s execution, 15 s Worker deadline, one attempt, 429 with Retry-After, terminating cancellation); `200 image/png` with renderer-version/request-ID headers and `no-store`; stable `{ code, message, retryable }` errors; liveness plus font/rasterizer readiness without secrets.

## Next action

Approve or amend the Netlify Free primary (Cloud Run fallback) to unblock `c-external-render-service`. Still required before implementation: deploy the renderer to the chosen host from its owner account (about 15 minutes, Bearer secret via the host's secret storage), then record deployed Worker CPU on hits and misses at the 31-row and 250-row fixtures plus the Meta-fetch end-to-end in the release story. `scripts/poc-render-fixture.mjs` (seed/restore) is kept for re-verification.
