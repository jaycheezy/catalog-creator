---
id: "c-external-render-adapter"
slice: "external-render-service"
title: "Cut traffic over to Netlify and retire the Worker"
step: "feed"
status: "proposed"
effort: "M"
order: 3
tags: ["netlify", "dns", "cutover"]
dependsOn: ["c-external-render-service", "c-reliable-versioned-renders", "c-reliable-publish-project"]
implementation: "specified"
value: "Moves merchants and Meta to the Netlify deployment without breaking saved feed URLs, then retires the Cloudflare Worker so only one production app exists."
---

# Cut traffic over to Netlify and retire the Worker

## Summary

Point the production domain at the Netlify deployment, verify Meta-facing feed and image URLs work anonymously, and retire the Cloudflare Worker deployment so R2 and DNS are the only remaining Cloudflare responsibilities. No data migration: both deployments address the same R2 buckets and keys.

## Acceptance criteria

- The production domain serves the app from Netlify with valid SSL; anonymous feed and versioned image URLs return the same bytes and headers as the verified deploy preview.
- Previously shared capability feed URLs keep working when they address unchanged R2 assets; any URL that cannot be honored fails with the existing stable 404/409/503 semantics, never a silent wrong feed.
- The Cloudflare Worker deployment is retired or neutered (no competing production app), with the decision and rollback recorded; R2 buckets, keys, and stored assets are untouched.
- Rate-limit, validation, publication-boundary, and draft-isolation behavior is unchanged from the Reliable Catalog contracts.
- Rollback (re-point DNS to the previous deployment) is documented and was reasoned through before cutover, including R2 compatibility in both directions.

## Scope

Own DNS/domain configuration, the cutover checklist and verification, Worker retirement, and rollback documentation. Exclude renderer implementation (rasterization is in-route), changing the publication/versioning model, bulk pre-rendering, and any Cloudflare plan upgrade.

## Implementation guidance

Implement after the hosting story is reviewed. Keep Cloudflare DNS authoritative; decide explicitly between proxying through Cloudflare's CDN (keeps edge caching, firewall, and analytics in front of Netlify) versus direct DNS to Netlify, and record the choice with reasons. Either way the origin of truth for product data and image bytes stays the same R2 buckets.

Cut over in order: deploy preview green, custom domain attached with SSL, anonymous feed CSV plus one miss and one hit image per placement verified on the production domain, editor publish/republish round-trip verified, then Worker retirement, then a final anonymous re-verification. Retire by removing the Worker deployment or its route triggers (not by deleting R2 buckets or DNS records); keep the `wrangler.jsonc` and deployment files in the repository for the R2/DNS side and for a possible rollback.

Read the hosting story handoff for site identifiers and assumptions, `src/app/api/feed/route.ts`, `src/app/api/render/route.tsx`, and the publication/versioning contracts. Preserve exact product selection and revision checks; the cutover must not change request/response semantics, only where they are served from.

## Interfaces

- Public URLs keep their shapes; only the hostname changes. Capability IDs remain unguessable share links; no credentials appear in URLs.
- R2 bucket names, object keys, ETags, and cache headers are identical on both sides of the cutover because both deployments address the same buckets.
- The rollback target is the previous deployment plus the same R2 state; no data migration exists in either direction.

## Validation

Verify DNS resolution, certificate validity, anonymous feed/image access on the production domain, one cache miss followed by an R2 hit per placement, old-asset survival after republish, draft isolation, and unpublished-project 404s. Confirm the retired Worker serves nothing production (or only the documented redirect) and that R2 objects were never rewritten by the cutover. Record redacted request logs and header evidence. Run `npm run story-map:check` plus the application test/typecheck/lint/build commands; Netlify deployment checks replace `cf:build` for this slice.

## Completion handoff

Report DNS/domain changes, the Worker retirement action, verification evidence per acceptance bullet, rollback steps, and any hostname-specific limitation. Move to `in-review` only after production traffic is served from Netlify with the Worker retired.

## Progress

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Use the [complementary local proof and hosting corrections](notes/2026-09-06-native-next-local-benchmark.md) with the parallel spike proposal: native Next pixel parity passed locally; the Netlify buffered candidate uses a 4 MiB PNG cap and current credit-based pricing. Hosted cold starts, safe remote-image handling, actual Free Worker CPU and quota behavior remain separate gates. No readiness promotion follows from the local benchmark.

- 2026-09-06 — Rescoped per the Netlify-hosting decision: no Worker adapter or renderer client exists anymore (in-route rasterization needs none), so this story now owns DNS cutover, verification, and Worker retirement instead. Stays proposed until the hosting story is reviewed.

- 2026-09-07 — Before cutover/Worker retirement, require hosted API query-isolation proof and invalidation of the old broad CDN entries. The Netlify subdomain currently serves a square image for a portrait request. See [cache-isolation blocker](notes/2026-09-07-netlify-cache-query-isolation.md); successful single-image access is insufficient for cutover.
