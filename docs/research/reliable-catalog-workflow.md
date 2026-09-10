# Reliable Catalog workflow evidence

Evidence date: 2026-09-10  
Working-tree base: `53b3bf07486e36ea769c25472ab074e241d4aa90`  
Production host: `https://cataloghog.netlify.app`

This index separates repeatable application checks, local runtime evidence, deployed-host evidence, and manual external acceptance. Capability IDs, cookies, credentials, private source URLs, and complete feed/image URLs are intentionally omitted.

## Source and journey matrix

| Source or behavior | Fixture and expected result | Current evidence | Status |
| --- | --- | --- | --- |
| Shopify | One physical product with two variants, different prices/images, stable `shopify:variant:*` identities and GBP currency provenance | `tests/projects.test.ts`, `tests/feed-render.test.ts`, `tests/renderProduct.test.ts`, `tests/publication.test.ts` | Automated |
| WooCommerce | One product with USD price and stable `woocommerce:product:*` identity | `tests/projects.test.ts`, `tests/feed-render.test.ts`, `tests/placementRender.test.ts`, `tests/publication.test.ts` | Automated |
| Uploaded CSV | 250 rows; decimal-comma CHF/EUR normalization, malformed decimal after row 50, and a later missing image remain visible in the saved project verdict | `tests/projects.test.ts`, `tests/feedImport.test.ts`, `tests/catalogValidation.test.ts` | Automated |
| Remote CSV | Bounded remote-import seam restores the final feed URL, parsed rows, format, template and source state | `tests/projects.test.ts`, `tests/feedImport.test.ts`, `tests/publication.test.ts` | Automated |
| Remote XML | Namespaced RSS fixture decodes named/numeric entities, preserves a CHF sale, creates stable `xml:row:*` identities, and reports the exact missing-image row | `tests/fixtures/workflow.ts`, `tests/feedImport.test.ts`, `tests/projects.test.ts` | Automated |
| Design stress | Long text, sale content, rotation, opacity, borders, shadows, padding, fallback fonts and missing-image copy reach the server projection | `tests/renderParity.test.ts`, `tests/renderSmoke.test.ts`, `tests/renderStyles.test.ts` | Automated |
| Four placements | `1:1` 1080×1080, `4:5` 1080×1350, `9:16` 1080×1920 and `1.91:1` 1200×628 persist atomically with independent IDs/revisions | `tests/placementExports.test.ts`, `tests/placementRender.test.ts` | Automated |
| Save failure | Aggregate failure returns retryable 503 without advancing; a later compatibility-mirror failure keeps the confirmed aggregate revision successful | `tests/placementExports.test.ts`, `tests/projects.test.ts`, `tests/durableSaves.test.ts` | Automated |
| Publish/reopen/update | Exact revision guard, skipped invalid rows, stable feed URL, private draft, failed republish preservation, reopen summary, new immutable URL and old-byte survival | `tests/publication.test.ts`, `tests/publicationStore.test.ts`, `tests/versionedRenders.test.ts` | Automated |
| Local R2 runtime | OpenNext/Workerd create → publish → reopen → anonymous feed; concurrent same-revision publish is idempotent; PNG is byte-identical across `miss` → `hit` | [publication review evidence](../slices/reliable-catalog/notes/2026-09-06-render-publication-review-fixes.md) | Verified locally |
| Netlify/R2 | Production PNG and query isolation verified on deploy `6a9f0dd706a33b0008cf9f48`; Worker retired while R2/code remain | [Netlify release ledger](external-render-service/release.md), [retirement evidence](../slices/external-render-service/notes/2026-09-08-worker-retirement.md) | Verified baseline |
| Desktop/narrow editor | A 75-row CHF/sale CSV completed save → four placements → publish → reopen → dirty-state block → republish; anonymous images had exact dimensions, stable repeat bytes and a changed immutable URL after a visible edit; controls remained usable at 390×844 | [local browser response artifact](evidence/reliable-catalog/local-browser-2026-09-10.md) | Verified locally |
| Manual Meta import | Stable anonymous feed must be added as a Meta catalog data source and the sanitized accepted/rejected item result recorded | — | Outstanding external action |

## Failure and recovery contract

The project aggregate is authoritative. If its write fails, the route returns a retryable error and neither its revision nor the legacy template mirror advances. If the aggregate succeeds and the legacy mirror fails, the project request remains successful so the editor receives the confirmed revision; the server records a sanitized compatibility warning and a later save can reconcile the mirror.

Publication activation uses guarded R2/S3 writes. A failed or older request cannot replace a newer active snapshot or newer attempt history. Failed publication and render-cache writes keep the prior public feed and stored immutable bytes available.

## Reproduction commands

Run sequentially from the repository root:

```sh
npm run check
npm run build
npm run cf:build
git diff --check
```

The consolidated check generates and validates the story map, runs all Vitest files, typechecks, and lints authored source. The Cloudflare build is compatibility validation for the retained rollback artifact; production traffic is served by Netlify.

Results on 2026-09-10:

- `npm run check`: 23 files / 152 tests passed; typecheck and lint passed without warnings.
- `npm run build`: passed; 96 static paths generated.
- `npm run cf:build`: passed with the retained OpenNext warning that Node.js middleware support on Cloudflare is experimental.
- `git diff --check`: passed.

The isolated browser run used the compiled application because another Next development process held the repository's dev lock. It verified the 75-row import, desktop and 390×844 controls, save/publish/reopen/update state, four exact placement dimensions, anonymous feed/image access, repeat-byte stability, changed image identity and pixels after a visible edit, and prior-image survival. See the [sanitized response artifact](evidence/reliable-catalog/local-browser-2026-09-10.md).

## Remaining release evidence

The reviewed working tree must be deployed to Netlify before production results can be attributed to these publication, XML, decimal-validation, mirror-recovery, and browser-verified workflow changes. After deployment, capture anonymous feed/PNG headers, cache behavior, old-asset survival, and hosted failure/recovery using the [operations runbook](external-render-service/runbook.md). The local desktop/narrow journey does not substitute for that hosted evidence.

The manual Meta step requires an authorized Meta catalog session and a disposable or approved catalog. Record only the date, Netlify deploy ID, item count, accepted/rejected outcome, and sanitized diagnostic codes.
