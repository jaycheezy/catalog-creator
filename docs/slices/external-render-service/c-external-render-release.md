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

Exercise the complete published-feed workflow against the Netlify production deployment backed by Cloudflare R2, including first render, cache reuse, changed revisions, failure recovery, usage consumption, and an external anonymous fetch.

## Acceptance criteria

- A published fixture feed returns HTTP 200 CSV with versioned image URLs, and at least one fresh image URL returns HTTP 200 PNG anonymously on the production domain.
- Repeated image requests preserve ETag/bytes and demonstrate both CDN reuse and an origin R2 hit without re-rasterization. Record Cache-Status and Age alongside X-Render-Cache; a CDN can replay an original miss marker. Timing alone is not evidence of an R2 hit.
- CDN cache isolation passes across products, projects, templates, placements, revisions and draft flags; feed query variants also return their own data. Effective Netlify-Vary includes all API query parameters, and pre-fix broad cache entries are invalidated.
- A changed product or design produces a new image URL while the old immutable image remains retrievable.
- R2 outage or invalid credentials produce a bounded retryable error and leave the prior cached asset and published feed unchanged.
- Draft URLs remain private and unpublished project URLs do not expose draft data.
- Netlify usage for the release run is recorded and projected against the actual Free Legacy allowances; no step requires a paid plan.
- Production browser evidence shows the deployed app, feed controls, and a representative rendered result; all committed evidence redacts capability IDs, credentials, and private catalog data.

## Scope

Own release verification, smoke fixtures, observability review, runbook, and story handoff. Do not redesign the hosting, silently fix unrelated publication/versioning behavior, or approve provider spend; record defects against their owning story.

## Implementation guidance

Own `docs/research/external-render-service/release.md` and a linked runbook, with synthetic fixtures and deployment identifiers. Coordinate with `c-reliable-workflow-check`: this slice proves the Netlify/R2 production boundary; the Reliable Catalog story owns the full source matrix and manual Meta acceptance. Link one shared evidence set instead of requiring duplicate imports or declaring the Reliable Catalog slice complete here.

Use isolated fixtures for failure injection; never disable shared production credentials to test an outage (use an invalid key against a disposable binding or a documented negative path). Record deployment order (R2/buckets first, then Netlify deployment, then DNS cutover), secret rotation, capacity alerts, rollback behavior and cleanup. Rollback must not regenerate different pixels under old keys. Compare cold and warm function timings separately, including the larger catalog fixture and concurrent cache misses.

Use the published snapshot and versioned URL contracts from the Reliable Catalog slice. Verify the Netlify deployment and the R2 bucket state, then inspect response headers and redacted function logs. If Meta access is tested, use a disposable or already authorized catalog and record only the import/result status, never credentials or full capability URLs.

## Interfaces

Define the evidence bundle: deployment identifiers, feed status/headers, image status/content type/ETag/cache marker, R2 object evidence, outage response, Netlify usage consumption, and browser observations. Keep the runbook usable by a future maintainer without requiring access to secret values. The runbook must document Netlify log access, environment variable rotation, the credit dashboard to watch, and the Cloudflare R2 dashboard to watch.

## Validation

Test both a new-key miss during an R2 outage and an already cached key during the same outage: the miss fails within deadline, while the hit path behavior follows the route's specified failure semantics. Verify every production raster branch, PNG dimensions/pixel parity, private draft responses and rejection of draft-only assets through the stale public path. Distinguish build, local service, deployed function timings, actual R2, and manual Meta evidence in the matrix; do not infer one from another.

Run `npm run story-map:check`, the application test/typecheck/lint/build commands, and Netlify production smoke requests. Exercise anonymous feed/image access, cache miss/hit, old asset survival, republish, outage behavior, and draft isolation. Capture browser evidence only after the visible result is present.

## Completion handoff

Report the final architecture, deployment identifiers, smoke results, cache evidence, usage consumption, remaining limitations, runbook location, and follow-up work. Move to `in-review`; mark the slice complete only after the release evidence is independently reviewable.

## Progress

- 2026-09-10 — Production verification began against ready Netlify deploy `6aa2fe6d9942ce0008928f2d`, whose commit exactly matched the clean reviewed checkout. An isolated 75-row CHF/sale project passed authentication, import, four-placement save, first publish, anonymous feed/render, R2-reuse, query-isolation, draft-isolation, update-save and update-publish assertions. The run then found that the unchanged feed URL still served the prior CSV/image URL because the route granted Netlify a one-hour shared-cache TTL. The focused correction and full gate pass locally (23 files / 152 tests, typecheck, 0 lint warnings, Next and OpenNext/Cloudflare builds), but the release stays `proposed` until redeploy and a complete rerun. See [the stable-feed blocker](notes/2026-09-10-netlify-stable-feed-staleness.md).

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Use the [complementary local proof and hosting corrections](notes/2026-09-06-native-next-local-benchmark.md) with the parallel spike proposal: native Next pixel parity passed locally; the Netlify buffered candidate uses a 4 MiB PNG cap and current credit-based pricing. Hosted cold starts, safe remote-image handling, actual Free Worker CPU and quota behavior remain separate gates. No readiness promotion follows from the local benchmark.

- 2026-09-06 — Rescoped per the Netlify-hosting decision: release proof now targets the Netlify deployment with R2 on Cloudflare (no separate renderer deployment, no Worker CPU evidence). Actual-plan usage is explicit acceptance. Stays proposed until the cutover story is reviewed.

- 2026-09-07 — Owner reports successful UI CSV export and the prior agent reports 31 published rows plus a matching R2 object. Independently verified production PNG correctness, CDN reuse and an origin R2 hit. Confirmed placement cache collision; release remains blocked on deploying the query-variation fix and completing the isolation matrix. This evidence does not establish draft safety, custom-domain cutover, outage recovery or billing usage. See [cache-isolation finding and deployment checks](notes/2026-09-07-netlify-cache-query-isolation.md).

- 2026-09-07 — Owner-confirmed cache checks are complete; the query-isolation blocker is resolved. Added [release evidence ledger](../../research/external-render-service/release.md) and [operational runbook](../../research/external-render-service/runbook.md). Current production address is `cataloghog.netlify.app`; custom-domain work is deferred. Remaining release evidence is listed separately from the completed cache checks. Parallel task owns render/versioning implementation and Reliable Catalog story updates.

- 2026-09-08 — Worker retirement and Netlify baseline checks complete; actual account is Free Legacy. The [retirement handoff](notes/2026-09-08-worker-retirement.md) records live deploy ID, PNG/hash/header evidence, team usage and conservative bandwidth/build projection. Hosted failure/recovery and release-specific usage delta are not claimed complete.
