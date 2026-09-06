---
id: external-render-contract-review
title: Define raster ownership, feasibility gates and cache compatibility
type: decision
status: resolved
author: Codex
updated: "2026-09-06"
story: c-external-render-spike
affects:
  - c-external-render-service
  - c-external-render-adapter
  - c-external-render-release
  - c-reliable-workflow-check
---

## Summary

Specification review tightened the external renderer boundary without selecting a host or implementing a service. The spike stays ready; service, adapter and release stay proposed. Hosting, measured limits and any pixel-version migration remain spike outputs. The production CPU blocker stays open for implementation/release and no longer incorrectly blocks the spike investigating it.

## Evidence

Repository inspection found three `ImageResponse` call sites in `src/app/api/render/route.tsx`, not just the public cache miss. The versioned hit path still loads the full publication and computes a product hash. `renderCache.ts` uses template-aware v2 keys; `renderProduct.ts` emits `assetVersion=2` but no explicit renderer version. The recent tests cover cached square images after portrait republish, private draft bypass and distinct placement assets. `renderElement.tsx` forwards remote image URLs to the rasterizer and uses a deterministic placeholder when the URL is empty; it does not supply a bounded image loader. Hashing an image URL does not freeze changing image bytes.

The prior note's production 1102 observation is preserved as reported evidence, not remeasured here. Cloudflare's [current limits documentation](https://developers.cloudflare.com/workers/platform/limits/) lists the Free HTTP CPU budget separately from network waiting, supporting an explicit deployed Worker-overhead gate in addition to service latency measurements.

## Impact

The [slice contract](../index.md) now owns explicit request/error shapes, proposed numeric budgets, hard cancellation, admission control, image network policy, all route modes and pixel/version migration rules. Raw R2 keys/project capabilities are removed from the internal job. Service owns the isolated runtime and shared pure schema; adapter owns the Worker route/client and any approved URL migration. The adapter also depends on review completion of the Reliable Catalog publication/versioning foundations.

The external release owns runtime/cache evidence. The Reliable Catalog workflow now depends on that release and reuses the evidence, retaining its broader source journey and manual Meta import. There is no reverse dependency or duplicate Meta submission requirement. None of these changes approves a provider, recurring spend or production deployment.

## Next action

Assign `c-external-render-spike` first. Produce the bounded PoC, actual remaining-Worker CPU measurements, dated host/cost comparison and frozen contract decision. If runtime access or feasibility fails, leave downstream work proposed and record the missing gate. Do not resolve the production blocker until deployed misses and hits pass. Spec-only validation uses `npm run story-map:check`; application tests/builds are not new evidence for this review.
