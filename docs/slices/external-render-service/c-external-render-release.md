---
id: "c-external-render-release"
slice: "external-render-service"
title: "Prove production on Netlify end to end"
step: "test"
status: "proposed"
effort: "M"
order: 4
tags: ["netlify", "meta", "release"]
dependsOn: ["c-external-render-adapter"]
implementation: "specified"
value: "Gives the merchant confidence that a published catalog feed and its branded images work on the new production host, including cache reuse, failures, and credit usage."
---

# Prove production on Netlify end to end

## Summary

Exercise the complete published-feed workflow against the Netlify production deployment backed by Cloudflare R2, including first render, cache reuse, changed revisions, failure recovery, credit consumption, and an external anonymous fetch.

## Acceptance criteria

- A published fixture feed returns HTTP 200 CSV with versioned image URLs, and at least one fresh image URL returns HTTP 200 PNG anonymously on the production domain.
- The second request for the same image returns the same ETag/bytes and demonstrates an R2 cache hit with no re-rasterization (sub-second response).
- A changed product or design produces a new image URL while the old immutable image remains retrievable.
- R2 outage or invalid credentials produce a bounded retryable error and leave the prior cached asset and published feed unchanged.
- Draft URLs remain private and unpublished project URLs do not expose draft data.
- Netlify credit consumption for the release run is recorded and projected against the free allowance; no step requires a paid plan.
- Production browser evidence shows the deployed app, feed controls, and a representative rendered result; all committed evidence redacts capability IDs, credentials, and private catalog data.

## Scope

Own release verification, smoke fixtures, observability review, runbook, and story handoff. Do not redesign the hosting, silently fix unrelated publication/versioning behavior, or approve provider spend; record defects against their owning story.

## Implementation guidance

Own `docs/research/external-render-service/release.md` and a linked runbook, with synthetic fixtures and deployment identifiers. Coordinate with `c-reliable-workflow-check`: this slice proves the Netlify/R2 production boundary; the Reliable Catalog story owns the full source matrix and manual Meta acceptance. Link one shared evidence set instead of requiring duplicate imports or declaring the Reliable Catalog slice complete here.

Use isolated fixtures for failure injection; never disable shared production credentials to test an outage (use an invalid key against a disposable binding or a documented negative path). Record deployment order (R2/buckets first, then Netlify deployment, then DNS cutover), secret rotation, capacity alerts, rollback behavior and cleanup. Rollback must not regenerate different pixels under old keys. Compare cold and warm function timings separately, including the larger catalog fixture and concurrent cache misses.

Use the published snapshot and versioned URL contracts from the Reliable Catalog slice. Verify the Netlify deployment and the R2 bucket state, then inspect response headers and redacted function logs. If Meta access is tested, use a disposable or already authorized catalog and record only the import/result status, never credentials or full capability URLs.

## Interfaces

Define the evidence bundle: deployment identifiers, feed status/headers, image status/content type/ETag/cache marker, R2 object evidence, outage response, Netlify credit consumption, and browser observations. Keep the runbook usable by a future maintainer without requiring access to secret values. The runbook must document Netlify log access, environment variable rotation, the credit dashboard to watch, and the Cloudflare R2 dashboard to watch.

## Validation

Test both a new-key miss during an R2 outage and an already cached key during the same outage: the miss fails within deadline, while the hit path behavior follows the route's specified failure semantics. Verify every production raster branch, PNG dimensions/pixel parity, private draft responses and rejection of draft-only assets through the stale public path. Distinguish build, local service, deployed function timings, actual R2, and manual Meta evidence in the matrix; do not infer one from another.

Run `npm run story-map:check`, the application test/typecheck/lint/build commands, and Netlify production smoke requests. Exercise anonymous feed/image access, cache miss/hit, old asset survival, republish, outage behavior, and draft isolation. Capture browser evidence only after the visible result is present.

## Completion handoff

Report the final architecture, deployment identifiers, smoke results, cache evidence, credit consumption, remaining limitations, runbook location, and follow-up work. Move to `in-review`; mark the slice complete only after the release evidence is independently reviewable.

## Progress

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Use the [complementary local proof and hosting corrections](notes/2026-09-06-native-next-local-benchmark.md) with the parallel spike proposal: native Next pixel parity passed locally; the Netlify buffered candidate uses a 4 MiB PNG cap and current credit-based pricing. Hosted cold starts, safe remote-image handling, actual Free Worker CPU and quota behavior remain separate gates. No readiness promotion follows from the local benchmark.

- 2026-09-06 — Rescoped per the Netlify-hosting decision: release proof now targets the Netlify deployment with R2 on Cloudflare (no separate renderer deployment, no Worker CPU evidence). Credit consumption is explicit acceptance. Stays proposed until the cutover story is reviewed.
