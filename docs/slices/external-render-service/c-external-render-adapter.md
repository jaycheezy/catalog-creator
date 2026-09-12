---
id: "c-external-render-adapter"
slice: "external-render-service"
title: "Confirm Netlify traffic and retire the Worker"
step: "feed"
status: "done"
effort: "M"
order: 3
tags: ["netlify", "dns", "cutover"]
dependsOn: ["c-external-render-service", "c-reliable-versioned-renders", "c-reliable-publish-project"]
implementation: "specified"
value: "Moves merchants and Meta to the Netlify deployment without breaking saved feed URLs, then retires the Cloudflare Worker so only one production app exists."
---

# Confirm Netlify traffic and retire the Worker

## Summary

Use `cataloghog.netlify.app` as the owner-selected production address, verify that merchant and feed consumers use it, and retire the Cloudflare Worker only after legacy consumers and a viable rollback are accounted for. Custom-domain attachment and DNS cutover are deferred. No data migration: both deployments address the same R2 buckets and keys.

## Acceptance criteria

- `cataloghog.netlify.app` serves the app over HTTPS and is the documented production address; anonymous feed and versioned image URLs preserve the verified behavior. No custom domain or DNS change is required for this release.
- Previously shared capability feed URLs keep working when they address unchanged R2 assets; any URL that cannot be honored fails with the existing stable 404/409/503 semantics, never a silent wrong feed.
- The Cloudflare Worker deployment is retired or neutered (no competing production app), with the decision and rollback recorded; R2 buckets, keys, and stored assets are untouched.
- Rate-limit, validation, publication-boundary, and draft-isolation behavior is unchanged from the Reliable Catalog contracts.
- Rollback uses a verified prior Netlify deployment with query isolation and compatible R2 keys. The Free Worker that failed raster CPU limits is not a proven full-service rollback.

## Scope

Own production-address documentation, legacy consumer inventory, Worker retirement, and rollback documentation. Custom-domain/DNS work is deferred by the owner. Exclude renderer implementation (rasterization is in-route), changing the publication/versioning model, bulk pre-rendering, and any Cloudflare plan upgrade.

## Implementation guidance

Implement retirement after the hosting and publication/versioning prerequisites are reviewed. Keep the current Netlify subdomain; no DNS/proxy choice is needed now. Inventory the Worker’s deployed routes, workers.dev and preview access, and consumers of its saved feed URLs before disabling access. Repository wrangler configuration alone is not proof of live routes or traffic.

Proceed in order: reviewed Netlify deployment and owner-confirmed cache checks, inventory legacy feed consumers and migrate any active ones, confirm a viable Netlify rollback deployment, then Worker retirement and final anonymous verification. Retire by removing the Worker deployment or its route triggers (not by deleting R2 buckets or DNS records); keep the `wrangler.jsonc` and deployment files in the repository for the R2/DNS side and for a possible rollback.

Read the hosting story handoff for site identifiers and assumptions, `src/app/api/feed/route.ts`, `src/app/api/render/route.tsx`, and the publication/versioning contracts. Preserve exact product selection and revision checks; the cutover must not change request/response semantics, only where they are served from.

## Interfaces

- Public URLs keep their shapes and the selected Netlify hostname. Existing Worker-hostname consumers require explicit inventory and migration. Capability IDs remain unguessable share links; no credentials appear in URLs.
- R2 bucket names, object keys, ETags, and cache headers are identical on both sides of the cutover because both deployments address the same buckets.
- The rollback target is a compatible previous Netlify deployment plus the same R2 state. Never roll back to a build missing query isolation or assume the CPU-limited Worker can rasterize misses.

## Validation

Verify DNS resolution, certificate validity, anonymous feed/image access on the production domain, one cache miss followed by an R2 hit per placement, old-asset survival after republish, draft isolation, and unpublished-project 404s. Confirm the retired Worker serves nothing production (or only the documented redirect) and that R2 objects were never rewritten by the cutover. Record redacted request logs and header evidence. Run `npm run story-map:check` plus the application test/typecheck/lint/build commands; Netlify deployment checks replace `cf:build` for this slice.

## Completion handoff

Report DNS/domain changes, the Worker retirement action, verification evidence per acceptance bullet, rollback steps, and any hostname-specific limitation. Move to `in-review` only after production traffic is served from Netlify with the Worker retired.

## Progress

- 2026-09-11 — Independent review accepted the cutover and retirement evidence. Netlify is the documented production host, active feed consumers use it, the former Worker public and preview endpoints remain disabled with zero Git triggers, and R2 objects were preserved. The current reviewed Netlify deploy supplies the compatible recovery point and passed anonymous feed/image checks after retirement. Story moved to `done`.

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Use the [complementary local proof and hosting corrections](notes/2026-09-06-native-next-local-benchmark.md) with the parallel spike proposal: native Next pixel parity passed locally; the Netlify buffered candidate uses a 4 MiB PNG cap and current credit-based pricing. Hosted cold starts, safe remote-image handling, actual Free Worker CPU and quota behavior remain separate gates. No readiness promotion follows from the local benchmark.

- 2026-09-06 — Rescoped per the Netlify-hosting decision: no Worker adapter or renderer client exists anymore (in-route rasterization needs none), so this story now owns DNS cutover, verification, and Worker retirement instead. Stays proposed until the hosting story is reviewed.

- 2026-09-07 — Before cutover/Worker retirement, require hosted API query-isolation proof and invalidation of the old broad CDN entries. The Netlify subdomain currently serves a square image for a portrait request. See [cache-isolation blocker](notes/2026-09-07-netlify-cache-query-isolation.md); successful single-image access is insufficient for cutover.

- 2026-09-07 — Owner confirms cache checks complete and explicitly chooses to keep `cataloghog.netlify.app`. Custom-domain work removed from current acceptance. Retirement remains pending live Worker/consumer inventory and reviewed prerequisites; no DNS changes or Worker deletion performed. See [operational runbook](../../research/external-render-service/runbook.md).

- 2026-09-07 — Read-only live Cloudflare inventory: `catalog-forge` workers.dev and preview access are enabled; custom-domain lookup returned no domains. Zone-level routes and legacy feed consumers still need inventory before retirement. The parallel task confirmed it owns only publication review and will not modify hosting/deployment/DNS. No infrastructure mutation performed.

- 2026-09-08 — Retirement completed after owner confirmed all consumers use Netlify and the parallel publication review finished. Public/preview Worker URLs disabled, Git integration disconnected (zero triggers), no zone/custom-domain routes; old hostname returns 403 and Netlify image remains 200 with identical bytes. Added disabled endpoint flags to Wrangler config. Known-good Netlify baseline and restoration details recorded in [retirement handoff](notes/2026-09-08-worker-retirement.md). Moved to in-review; no storage deletion or Netlify deployment.
