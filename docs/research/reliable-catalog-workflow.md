# Reliable Catalog workflow evidence

Evidence date: 2026-09-11

Deployed commit: `622cf2f52bd304498f8ef4285ac0f99410030631`
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
| Netlify/R2 | Deploy `6aa303eed8f0140008f61cf6` completed the 75-row publish/reopen/update journey: non-stale stable feed, changed and historical PNGs, Edge and origin R2 reuse, isolation, private drafts, failure recovery, browser controls, and exact placement dimensions. The same production build and adapter also passed isolated invalid-credential failure/recovery with unchanged production hashes. | [production and isolated-outage artifact](evidence/external-render-service/netlify-production-2026-09-10.md), [Netlify release ledger](external-render-service/release.md) | Verified |
| Desktop/narrow editor | A 75-row CHF/sale CSV completed save → four placements → publish → reopen → dirty-state block → republish; anonymous images had exact dimensions, stable repeat bytes and a changed immutable URL after a visible edit; controls remained usable at 390×844 | [local browser response artifact](evidence/reliable-catalog/local-browser-2026-09-10.md) | Verified locally |
| Manual Meta import | The stable anonymous feed updated an authorized Commerce Manager data source on a daily EUR schedule; Meta accepted all 30 incoming rows, removed 0, failed 0, and reported 0 issues | [sanitized Meta acceptance](evidence/reliable-catalog/meta-import-2026-09-11.md) | Verified externally |

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
- `npm run build`: passed; 97 static paths generated.
- `npm run cf:build`: passed with the retained OpenNext warning that Node.js middleware support on Cloudflare is experimental.
- `git diff --check`: passed.

The isolated browser run used the compiled application because another Next development process held the repository's dev lock. It verified the 75-row import, desktop and 390×844 controls, save/publish/reopen/update state, four exact placement dimensions, anonymous feed/image access, repeat-byte stability, changed image identity and pixels after a visible edit, and prior-image survival. See the [sanitized response artifact](evidence/reliable-catalog/local-browser-2026-09-10.md).

## Completion status

The corrected application path is verified on Netlify, including same-URL freshness, cache layers, image survival, query/draft isolation, application-level failure recovery, four placements, reopen, browser output, and Free Legacy usage/capacity evidence. Independent review accepted the external-render release, including its isolated invalid-credential failure/recovery evidence; all stories in that slice are now `done`.

The authorized Meta acceptance completed on 2026-09-11. Commerce Manager updated or added all 30 incoming products, removed 0, failed 0, and reported 0 issues while retaining one prior product through the selected non-deleting update mode. Every workflow acceptance row now has direct evidence.
