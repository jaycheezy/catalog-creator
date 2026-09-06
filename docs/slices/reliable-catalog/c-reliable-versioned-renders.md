---
id: "c-reliable-versioned-renders"
slice: "reliable-catalog"
title: "Cache renders by product and template revision"
step: "feed"
status: "in-review"
effort: "L"
order: 16
tags: ["next"]
dependsOn: ["c-reliable-durable-saves", "c-reliable-placement-exports", "c-reliable-variant-render"]
implementation: "specified"
value: "Always shows the latest product or design change in your ads, so shoppers never see old prices or sold-out styles."
---

# Cache renders by product and template revision

## Summary

Use the configured render bucket and configure the OpenNext data cache. Product or design changes must produce fresh assets without serving obsolete prices.

## Progress

- 2026-09-06 — Review fixes: added template identity to `renders/v2/` keys and ETags, added `assetVersion=2` to feed-issued images, preserved cached historical placement dimensions after master size changes, and bypassed all persistent caching for private drafts. Regression and local real-PNG evidence pass; `npm run check` passes 125 tests, typecheck, and lint with no warnings; both production builds pass. See [the shared review-fix decision](notes/2026-09-06-render-publication-review-fixes.md) for migration limits and evidence. Story stays `in-review`.
- 2026-09-06 — Picked up with all dependencies `done`. New `src/lib/renderCache.ts`: canonical product-content snapshot (fixed field order, absent as `""`), SHA-256 `productRevision` (16 hex chars) via `crypto.subtle`, `RenderAssetDescriptor`, sanitized `renders/v1/<project>/<product>/<size>/<dims>-p<prev>-t<trev>-r1.png` keys, quoted ETags, immutable `Cache-Control`. `buildRenderUrl` gained an explicit versioned project target (`projectId`, `productId`, `sizeId`, `productRevision`, `templateRevision`); legacy targets byte-identical.
- 2026-09-06 — New `src/lib/renderCacheStore.ts` with the specified hit/miss/unavailable/write-failure adapter result: R2 in production, process-local memory in dev/test, `DurableStorageError` otherwise. Fixed a real bug found by tests (destructuring shadow threw into the unavailable branch). `getRendersBucket` added beside the existing templates-bucket seam; `RENDERS_BUCKET` was already declared in `wrangler.jsonc` and typed in `worker-configuration.d.ts`.
- 2026-09-06 — Render route serves versioned project URLs from R2 (hit → immutable PNG + ETag; miss → render verified revision, store, return; stale product/template revision → 409; bad params → 400; unknown template/product → 404; missing bucket → retryable 503; write failure → correct bytes with short cache, never a false immutable claim). Rate limiting stays ahead of rendering; project loads once; no upstream refetch on the versioned path (fetch stubbed to throw in tests). Legacy domain/template path untouched. Feed route emits versioned `image_link`s for projects (a concurrent session authored the feed body mid-implementation against the same new APIs; imports completed and full suite verified — no conflicting design).
- 2026-09-06 — Editor builds versioned preview/PNG links from precomputed per-row revisions (legacy fallback retained). New `tests/versionedRenders.test.ts` (15: hash stability and per-field sensitivity, key/ETag shape, URL contracts, adapter unavailable/memory/write-failure, route miss→hit byte/ETag equality, price-change new URL, stale/malformed/wrong-placement/unknown 404-409 matrix, WooCommerce exact ID, feed-issued link round-trip, production-like 503).
- 2026-09-06 — `npm run check` green (16 files, 103 tests, typecheck, 0 lint warnings); `npm run build` and `npm run cf:build` pass (workers-compatible `crypto.subtle` + R2 types bundled). Example (redacted): `/api/render?templateId=tpl_…&projectId=prj_…&productId=shopify%3Avariant%3A102&sizeId=9%3A16&productRevision=<16hex>&templateRevision=2` → `renders/v1/prj_…/shopify_variant_102/9_16/1080x1920-p<16hex>-t2-r1.png`, ETag `"<16hex>.2.r1"`. Live Cloudflare byte-proof belongs to the workflow-check story. Publication can consume: stable feed URL rows pointing at these immutable image URLs.
- 2026-09-06 — Correction during publish-project implementation: editor preview links moved from versioned to legacy+`draft=1` URLs. Versioned URLs pin revisions against the published snapshot, so they cannot preview unsaved draft work; the owner draft flag plus authentication is the explicit preview path, and feed-issued links carry the versioned contract. Server/feed versioned behavior above is unchanged; editor wiring is owned by the publish story.

## Acceptance criteria

- Render cache keys include project, variant, product revision, template revision, and placement.
- A repeated request reuses the stored asset; a price, image, or design change yields a new image URL.
- Verify cache behavior in the Cloudflare runtime and avoid re-fetching the full upstream catalog for every image.

## Scope

Own deterministic product/template revision tokens, project render URL construction, the versioned `RENDERS_BUCKET` object key, cache hit/miss behavior, and immutable response headers. Project-backed rendering must use the saved project aggregate and the exact `source_id`. Preserve the existing legacy domain/template render path and its shorter cache policy. Exclude publication activation, scheduled regeneration, cache eviction, image CDN transforms, and bulk pre-rendering beyond bounded verification.

## Implementation guidance

Read [the versioned render contract](index.md), the placement story, `src/lib/renderProduct.ts`, `src/app/api/feed/route.ts`, `src/app/api/render/route.tsx`, the R2 binding declarations, and the local Next.js route/runtime guidance required by `AGENTS.md`. Add a pure canonical serializer and SHA-256 helper using APIs available in the Cloudflare runtime. The product revision must cover every normalized `FeedRow` field that can reach a binding or image output, including title, description, link, image, price, sale price, availability, brand, condition, and identifiers. Canonicalize absent values and object-key order so equivalent rows produce the same token.

Build project render URLs with `assetVersion=2`, `projectId`, exact product `source_id`, `templateId`, `sizeId`, product revision, and saved placement-template revision. Use the `renders/v2/` R2 prefix and sanitize untrusted path components. The object identity must include the template identity, renderer contract version, dimensions, and all content/design revisions required to guarantee byte stability. Never reuse ambiguous v1 objects. Resolve cached historical canonical placement dimensions from the requested size, not the master's current size; a cache miss must still match the current published snapshot before rendering.

On a project request, validate bounded query parameters, load the durable project once, select the exact product and saved placement, and verify both requested revisions before rendering. Check `RENDERS_BUCKET` first. On a hit, return the stored PNG and metadata. On a miss, render only when the request still matches the saved aggregate, store the bytes with content type and ETag metadata, then return them. Reject a stale revision with a stable `409` (or documented `404` where disclosure is unsafe); never place newly generated bytes at an old immutable key. Keep render rate limiting ahead of expensive work.

Do not refetch Shopify, WooCommerce, CSV, or remote feed sources from the render route. If the bucket is unavailable in production, return an actionable retryable service error rather than claiming a cached success. A development-only memory/filesystem adapter may support tests, but production must use the binding.

## Interfaces

Add named types/functions for a product-content revision, a render asset descriptor, and its canonical R2 key. Extend `buildRenderUrl` with a typed project variant containing `{ projectId, productId, sizeId, productRevision, templateRevision }`; keep the legacy variant explicit so callers cannot accidentally mix contracts.

Project render responses use `Content-Type: image/png`, an ETag derived from immutable identity or stored bytes, and `Cache-Control: public, max-age=31536000, immutable` only after revision verification. Define one storage adapter result for hit, miss/write, unavailable, and write failure so route tests can assert behavior without a real bucket.

## Validation

Add pure tests proving canonical hashes are stable and change for each render-relevant product or template input. Add route/storage tests for R2 hit, miss then put, repeated hit, stale product revision, stale template revision, wrong placement, exact variant selection, missing bucket, and write failure. Assert the miss and hit return the same bytes and ETag and that a price, image, size, or design change produces a new URL/key.

Use Shopify and WooCommerce project fixtures to prove the render path never invokes upstream fetch. Run the tests in the Cloudflare/OpenNext runtime or a faithful R2 mock and record the binding evidence. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run cf:build`.

## Completion handoff

Report the canonical fields and hash version, final query and R2 key examples with capability values redacted, cache hit/miss/write evidence, stale-revision behavior, no-upstream-fetch proof, Cloudflare binding result, and all command results. Move to `in-review`; identify the exact immutable URL/publication contract the publication story can consume.
