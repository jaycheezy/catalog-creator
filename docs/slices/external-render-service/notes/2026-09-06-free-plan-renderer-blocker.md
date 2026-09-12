---
id: "2026-09-06-free-plan-renderer-blocker"
title: "Free-plan Worker CPU limit blocks uncached branded PNGs"
type: blocker
status: resolved
author: "Codex"
updated: "2026-09-11"
affects: ["c-external-render-service", "c-external-render-adapter", "c-external-render-release"]
---

## Summary

The deployed Cloudflare Worker can serve the catalog page and CSV feed, but an uncached branded PNG render exceeds the Free-plan CPU limit and returns error 1102.

## Evidence

The production render request returned HTTP 503 with body `error code: 1102`. Cloudflare tail recorded `outcome: exceededCpu`, `cpuTime: 1552`, and `Worker exceeded CPU time limit` for version `4161f73d-2d00-4f5b-8f1b-f37c11c0a13f`. The same deployment returned HTTP 200 for `/api/feed` with 31 products. Adding `limits.cpu_ms` was rejected by Cloudflare with code 100328 because the Worker is on the Free plan; the setting was reverted and no replacement deployment was published.

## Impact

The current `ImageResponse` path cannot be the production cache-miss renderer on the Free plan. Existing versioned R2 hits and the client preview can remain useful, but a published feed cannot depend on a first-time Worker-side rasterization.

## Next action

Keep the Worker endpoints disabled unless a paid-plan restoration is deliberately reviewed. Production rasterization now runs inside the Netlify-hosted Next app, with R2 retained on Cloudflare.

## Resolution

The full application moved to Netlify, where native `ImageResponse` cache misses and all four placements passed production verification. Netlify CDN and origin R2 reuse were verified separately, and the CPU-limited Worker was retired without deleting R2 data. This removes the blocked Worker render path from production and resolves the finding.
