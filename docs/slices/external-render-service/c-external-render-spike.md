---
id: "c-external-render-spike"
slice: "external-render-service"
title: "Choose and prove the external Next renderer"
step: "connect"
status: "in-review"
effort: "M"
order: 1
tags: ["cloudflare", "renderer", "spike"]
dependsOn: []
implementation: "specified"
value: "Confirms that branded product images can be generated reliably without making the catalog app depend on a paid Cloudflare Worker plan."
---

# Choose and prove the external renderer

## Summary

Evaluate whether the existing native Next `ImageResponse` route can run on a small Node-capable host, then compare fallback runtimes only if needed. Produce one working proof of concept with a concrete recommendation for implementation.

## Acceptance criteria

- The feasibility report measures deployed Free-plan Worker overhead on cache hits and misses at the recorded 31-row and 250-row fixture sizes, separately from renderer latency; missing deployment access is an explicit unresolved gate.
- The decision freezes numeric limits, cancellation/concurrency behavior, safe image retrieval and the renderer parity/version policy before dependent implementation is ready.

- The first candidate is a Node-hosted route using the existing `next/og` `ImageResponse`, `renderTemplateElement`, styles, and bundled fonts; a custom rasterizer is considered only if this native route fails a stated gate.

- A candidate service accepts one representative template and product payload and returns a valid PNG through an authenticated request.
- The proof records cold-start and warm-request latency, payload/response size, concurrency behavior, and an estimated cost at low and moderate catalog traffic.
- The recommendation names one primary runtime and one fallback, with explicit reasons covering deployment ownership, secret storage, regional latency, observability, and failure recovery.
- The proposed service contract preserves the existing renderer version, product revision, template revision, dimensions, and R2 asset key semantics.
- The spike records a stopping decision if no candidate can meet the bounded PNG size and latency target without exposing credentials or requiring a paid Cloudflare Worker.

## Scope

Own feasibility research and a disposable or clearly isolated proof-of-concept. Do not change the production render route, editor, publication schema, or Cloudflare deployment. Do not commit credentials or upload real private catalog data.

## Implementation guidance

Treat the shared starting budgets as proposed acceptance gates, not measured facts. Bound the research to at most three candidates and one isolated PoC. Use official provider documentation for dated pricing/limits and estimate 1,000 and 100,000 uncached jobs/month, stating cache-hit assumptions, idle cost, egress, region and cold starts. An external host need not be free; do not assume a recurring spend commitment or a paid Cloudflare plan.

Prove remaining Cloudflare CPU separately from renderer wall time: include full-snapshot read/parse, row selection/hash, outbound payload serialization, PNG validation and R2 get/put using a representative 31-row catalog and a larger 250-row fixture. Use an isolated deployed probe when available without modifying the production route. If test deployment/access is unavailable, record that blocker and keep dependent work proposed; do not describe a local preview as production CPU proof. A failed overhead gate must propose a separately scoped metadata/read-path change instead of silently expanding the adapter.

Read the [shared architecture](index.md), `src/app/api/render/route.tsx`, `src/lib/renderCache.ts`, `src/lib/renderCacheStore.ts`, `src/editor/renderElement.tsx`, `src/editor/fonts.ts`, and the Cloudflare Free-plan failure evidence. Reuse the existing JSX/font renderer where the selected runtime supports it. Use a redacted stress fixture containing a product image, long title, price, sale price, and all supported placement dimensions.

Compare a small Node-hosted Next route first, then at most two alternatives such as a platform function/container or custom rasterizer if the native route fails. Keep the test endpoint private or protected and delete disposable resources after evidence is captured. The proof must demonstrate that the Worker imports only the runtime-neutral contract/client and not `next/og`, Satori, Resvg, or service-only dependencies.

## Interfaces

Freeze the schema, numeric limits, cancellation mechanism, queue/concurrency cap, error mapping, image-fetch policy and parity/version strategy from the slice index. Drop raw `assetKey` from the earlier request proposal: the service has no storage ownership. An opaque request ID is correlation, not a promise of persistent deduplication. Pinning renderer pixels/version and mutable image behavior must be explicit in the decision.

Define the proposed `POST /v1/render` request/response, authentication mechanism, maximum JSON/PNG sizes, timeout, idempotency key, and error codes. The request must contain a complete validated `Template` and `FeedRow` snapshot; the service must not fetch URLs other than the product image required by the existing renderer.

## Validation

Require one cold request and ten warm requests for each placement, plus a concurrent burst at the proposed service cap and one above it. Record latency samples/p50/p95, peak memory, active/queued jobs, cancellation recovery and the size of decoded images. Use controlled image fixtures so parity is not affected by a changing remote URL. Cold-plus-warm success does not establish byte determinism for arbitrary mutable image URLs. The stop condition is a gate failure or inability to obtain required runtime evidence: report a blocked decision and leave implementation proposed, rather than extending provider research indefinitely.

Run the proof with one cold request and at least ten warm requests across square, portrait, Story, and landscape dimensions. Verify PNG signature, dimensions, response content type, exact decoded-pixel parity against the current local `ImageResponse` output, credential rejection, malformed payload rejection, timeout behavior, and no committed secret or real customer data. Record the exact commands and redacted outputs in Progress or a linked implementation note.

## Completion handoff

Report the chosen and rejected runtimes, measured timings/sizes/cost assumptions, contract, security boundary, required secrets, and the exact next implementation story. Move to `in-review` only when the proof is reproducible or the blocker is explicit.


## Progress

- 2026-09-06 — Started the native Next spike, prioritizing a cost-free host for low traffic. Comparing at most Netlify Free, Render Free and Vercel Hobby; production routes and deployments stay unchanged. Local synthetic-fixture proof and dated cost model are in progress.

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Local PoC complete against a production `next start` build (no production code, route, or deployment changed; fixture seeded to `/tmp` dev stores and removed afterwards). Cold first render 545 ms; steady misses 89–435 ms; warm hits p50 1.8 ms / p95 2.7 ms; 6-concurrent-miss burst all 200 with 0.76 s wall; PNGs 40–84 KB with exact dims on all four placements and byte-identical refetches; remote Shopify image decodes. Free-plan rasterization is impossible (measured 1552 ms vs 10 ms budget, no free knob); bundle dry-run fits (2.56 MiB gzip vs 3 MiB limit). Recommendation: Netlify Free primary (commercial OK, no card, 10 s timeout), Cloud Run free fallback; Vercel Hobby rejected for production (non-commercial ban); Render Free rejected (sleep); Workers Paid $5 noted as the zero-change stay-on-Cloudflare alternative. Full numbers, dated provider terms, cost model, and frozen service contract: [the PoC proposal note](notes/2026-09-06-renderer-spike-poc.md). Open gates for the owner: deploy renderer to chosen host, deployed Worker CPU at 31/250 rows, Meta-fetch end-to-end.

- 2026-09-06 — Complementary isolated authenticated HTTP proof passes 44 exact-pixel/byte renders plus four missing-image cases, overload and hard cancellation. Fresh raster worker 144–213 ms; warm p95 62–132 ms. This is local evidence, not hosted cold starts or deployed Worker CPU. Reproduction and corrections to Netlify pricing/limits: [local benchmark finding](notes/2026-09-06-native-next-local-benchmark.md). Preserved the parallel investigation and existing `in-review` status.
