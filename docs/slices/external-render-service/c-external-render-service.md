---
id: "c-external-render-service"
slice: "external-render-service"
title: "Host the app on Netlify with R2 on Cloudflare"
step: "design"
status: "in-review"
effort: "L"
order: 2
tags: ["netlify", "r2", "hosting"]
dependsOn: ["c-external-render-spike"]
implementation: "specified"
value: "Runs the whole catalog app, including branded image rendering, on Netlify's free plan while product data and image files stay in the existing Cloudflare R2 buckets."
---

# Host the app on Netlify with R2 on Cloudflare

## Summary

Deploy the existing Next.js app on Netlify and replace Cloudflare R2 binding access with an S3-compatible client, so rasterization happens in-route through the proven native ImageResponse path and no separate renderer service is needed. R2 buckets, keys, versioned URLs, and the publication boundary stay exactly as specified by the Reliable Catalog slice.

## Acceptance criteria

- The app builds and serves on Netlify's free plan from the same repository, with no OpenNext/Cloudflare Worker build step in the deploy path.
- Every R2 read and write (templates, projects, publications, renders) goes through one S3-compatible seam; no runtime source file imports `getCloudflareContext`, R2 bindings, or service-only raster dependencies outside that seam.
- The render route produces PNGs in-route through the existing native `ImageResponse` pipeline with no external service call and no Worker fallback logic.
- Secrets (`ADMIN_PASSWORD`, R2 access keys) come from deployment environment variables; none are committed and none appear in URLs, logs, or client bundles.
- Existing versioned URL, R2 object-key, ETag, cache-header, publication-record, and validation contracts behave identically to the Cloudflare deployment. Netlify cache keys include all API query parameters, so products, projects, templates, placements, revisions and draft requests never share an unrelated response.
- The in-memory rate limiter's per-instance limits are documented as best-effort rather than abuse protection.

## Scope

Own the Netlify build/deploy configuration, the S3-compatible R2 adapter behind the existing store seams, environment wiring, store unit tests with mocked S3 clients, and deployment documentation. Exclude the traffic cutover and Worker retirement (adapter story), production proof and runbook (release story), changing the publication/versioning contracts, and any Cloudflare plan upgrade.

## Implementation guidance

Implement after the spike decision is reviewed. Read local Next.js route documentation before any Next code is authored. Keep the store function signatures (`getCatalogProject`, `saveCatalogProject`, `getPublicationRecord`, `savePublicationRecord`, template get/save, render-asset read/write) unchanged so callers and existing tests only swap the backing client.

Create one S3-compatible bucket accessor (region `auto`, endpoint `https://<account-id>.r2.cloudflarestorage.com`, path-style requests) used by every store module; map the existing object keys, `Content-Type` metadata, and ETag custom metadata one-to-one onto S3 `PutObject`/`GetObject` parameters. Read the account ID, access key ID, secret access key, and bucket names exclusively from server-side environment variables. Preserve the `/tmp` development fallback and the `CATALOG_FORGE_ALLOW_LOCAL_STORAGE` escape hatch for local production builds. Keep `ADMIN_PASSWORD` handling identical, sourced from the environment.

Remove or bypass the OpenNext Cloudflare build for the Netlify deployment (Netlify's own Next.js support), while leaving `wrangler.jsonc` and the Cloudflare deployment files untouched for the R2/DNS side. Share `renderTemplateElement`, `renderStyles`, `bindings`, and the bundled Inter fonts unchanged; reuse the existing fixture shape for render smoke tests. Demonstrate with a dependency check that Netlify function bundles do not import Cloudflare Worker bindings.

## Interfaces

- Environment (server-side only, never `NEXT_PUBLIC`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_TEMPLATES_BUCKET`, `R2_RENDERS_BUCKET`, `ADMIN_PASSWORD`. Local development keeps `.env` and `/tmp` fallbacks.
- Store seam: same function names, arguments, error shapes (`DurableStorageError`), and R2 object keys as today; only the transport changes from binding to S3-compatible HTTPS.
- Public route contract is unchanged: same feed/render URLs, status codes, ETags, and cache headers. Missing bucket configuration fails closed with the existing retryable 503s, never with silent local fallbacks in production.

## Validation

Add store unit tests with a mocked S3 client covering put/get with content-type and ETag metadata, missing-credential failure, and key stability against the current binding keys. Add an automated check that no runtime `src` file imports Cloudflare Worker bindings or the raster stack outside the approved seam. Extend the existing render/feed/publication suites only where the seam changes; do not weaken the parity, stale-revision, or draft-isolation assertions.

Run `npm run check`, `npm run build`, a Netlify deploy preview, and anonymous feed/render hit/miss smoke requests against it. Verify PNG signature, dimensions, ETag reuse, and redacted logs. Confirm no secret or capability URL is committed or logged.

## Completion handoff

Report the Netlify site/project identifier without secrets, changed store/config files, env var names without values, S3 key-mapping evidence, render smoke results, and the exact assumptions the cutover story may rely on. Move to `in-review` when the app is deployable on Netlify and independently testable against R2.

## Progress

- 2026-09-06 — Specification review aligned this story with the current three raster call sites, private-draft cache bypass and v2 render identity. No implementation or new runtime proof is claimed. See [the contract review note](notes/2026-09-06-external-render-contract-review.md).

- 2026-09-06 — Use the [complementary local proof and hosting corrections](notes/2026-09-06-native-next-local-benchmark.md) with the parallel spike proposal: native Next pixel parity passed locally; the Netlify buffered candidate uses a 4 MiB PNG cap and current credit-based pricing. Hosted cold starts, safe remote-image handling, actual Free Worker CPU and quota behavior remain separate gates. No readiness promotion follows from the local benchmark.

- 2026-09-06 — Rescoped per the Netlify-hosting decision: the separate renderer service is deleted as a concept (in-route rasterization fits the 10 s function timeout), and this story now owns the Netlify deployment plus the R2 S3-compatibility seam. Stays proposed until the spike decision is reviewed.

- 2026-09-06 — Implemented. New `src/lib/r2Client.ts` is the single R2 seam (`StoreBucket` get/put/list): S3-compatible env config first, Cloudflare binding second (rollback intact), null for local fallback. `durableStorage`, `renderCacheStore`, `templateStore`, and admin-password reads are off direct binding access; template listing rewritten onto seam `list()`. Added `@aws-sdk/client-s3`, `netlify.toml` (plain `npm run build`, Node 20), and README deploy docs with the env table. New `tests/r2Client.test.ts` (put/get/metadata/missing-key/list-pagination/partial-env) and `tests/storeSeam.test.ts` (automated no-binding-import boundary check). Gates: `npm run check` green (21 files, 130 tests, typecheck, 0 lint warnings), `npm run build` and `npm run cf:build` pass (Worker rollback still bundles), authored diff clean. Stays proposed until the spike decision is reviewed; a Netlify deploy preview is still required.
- 2026-09-06 — First Netlify build compiled and bundled successfully but failed at secrets scanning: it flagged the two R2 bucket *names* (public identifiers, also present in `wrangler.jsonc` and build output) while correctly finding no trace of the real credentials. Fixed with `SECRETS_SCAN_OMIT_KEYS = "R2_TEMPLATES_BUCKET,R2_RENDERS_BUCKET"` in `netlify.toml`, keeping the scan active for keys and passwords. No secret was exposed (`.env` is gitignored); nothing to rotate.
- 2026-09-06 — Ready for owner redeploy: push the `netlify.toml` fix (a rebuild of the old commit is not enough), confirm the build goes green, then run the deploy-preview smoke (anonymous feed CSV, one miss plus one hit image per placement, ETag reuse, login still gates the editor). Record the preview URL and results here before moving to `in-review`.
- 2026-09-07 — Production smoke on the Netlify deployment (Gibun feed, 31 rows): feed CSV 200 with versioned links; render URL returns 200 with a valid 1080×1080 PNG, immutable headers, and quoted-key ETag; the PNG bytes landed in `catalog-forge-renders` under the exact expected key (verified with an R2 download of identical size). Initial interpretation (superseded by the cache-isolation finding below): repeat requests for the same URL report `X-Render-Cache: miss` with render-like latency instead of hitting the stored object, although the key derivation is byte-identical on both paths. Correctness is unaffected (deterministic bytes), but every fetch re-rasterizes until resolved. Owner diagnostics requested: Netlify function logs, env var names, R2 read/write metrics.

- 2026-09-07 — Follow-up verified a Netlify durable hit replaying the original miss header and a fresh CDN variant reaching the R2-hit branch with identical bytes. The claim that every fetch re-rasterizes is withdrawn. Confirmed a different defect: changing size to 9:16 still returns the cached square because deployed Netlify-Vary excludes catalog query parameters. Added all-query variation for API routes in `next.config.ts`; status corrected to in-progress while the fix awaits deployment and hosted regression checks. See [cache-isolation blocker](notes/2026-09-07-netlify-cache-query-isolation.md).

- 2026-09-07 — Owner confirms the deployment/cache checks are complete and asks to continue. Cache-isolation blocker resolved on that confirmation; hosting moved to in-review. This is owner-reported hosted validation, not a new replay of the matrix. Production remains `cataloghog.netlify.app`; custom-domain work is deferred. See [release handoff](../../research/external-render-service/release.md).
