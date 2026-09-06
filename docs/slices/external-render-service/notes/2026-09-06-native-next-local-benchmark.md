---
id: native-next-local-benchmark
title: Native Next parity and bounded execution pass locally; free-host limits corrected
type: finding
status: open
author: Codex
updated: "2026-09-06"
story: c-external-render-spike
affects:
  - c-external-render-service
  - c-external-render-adapter
  - c-external-render-release
---

## Summary

A complementary isolated HTTP proof passed 44 exact-pixel/byte comparisons across the four placements, missing-image parity, authentication, bounded admission and hard termination. Keep native Next as the candidate. Hosting/deployed Worker evidence remains unproven. The current Netlify credit model and payload limits correct older assumptions in the parallel investigation.

## Evidence

See [reproduction, raw results, screenshots and dated hosting sources](../../../research/external-render-service/local-native-next-spike.md). Fresh local raster workers took 144–213 ms; warm uncached p95 was 62–132 ms. These are not hosted cold starts. `npm run check` passed 125 tests, typecheck and lint.

The [parallel proposal](2026-09-06-renderer-spike-poc.md) contains independent production-Next-route/cache evidence. Preserve those observations. Its Netlify legacy allowances and 10-second provider limit are superseded by the current documented credit model and 60-second synchronous limit; this does not relax our own 12/15-second deadlines. The 8 MiB PNG proposal becomes 4 MiB for the buffered candidate. Local timing alone cannot guarantee cost-free moderate production traffic.

## Impact

Service should reuse the shared Next projection and engine; its safe remote-image loader and deployment packaging are still needed. Adapter must respect the smaller payload cap and retain renderer-free R2 hits. Release must verify hosted cold starts, quota behavior and actual Worker CPU independently of local benchmark results. Local one-job admission is not a host-wide spending limit.

## Next action

Consolidate with the other agent's investigation and review the hosting choice. Keep the spike in review and downstream stories proposed; do not mark production CPU or hosted PNG gates satisfied. No additional deployment or provider exploration is being initiated in this task.
