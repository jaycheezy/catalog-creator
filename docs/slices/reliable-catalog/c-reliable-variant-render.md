---
id: "c-reliable-variant-render"
slice: "reliable-catalog"
title: "Fix variant-specific render URLs"
step: "feed"
status: "done"
effort: "M"
order: 15
tags: ["next"]
dependsOn: ["c-reliable-catalog-project", "c-reliable-store-mapping"]
implementation: "specified"
value: "Makes sure each size and price shows its own correct image, so a large item never shows a small item's price."
---

# Fix variant-specific render URLs

## Summary

Use exact source variant IDs throughout feed generation and rendering, so Large / €20 cannot render Small / €10. Connect these identities to saved catalog projects next.

## Acceptance criteria

- Render URLs identify the project and stable product/variant ID instead of matching a handle substring.
- Two variants of one product render their respective titles, prices, and available variant images.
- Unknown variant IDs return a clear error instead of falling back to a different product.

## Scope

Own stable internal product identity, provider-specific row IDs, render URL construction, exact row selection, legacy-handle compatibility, and explicit lookup errors for both project and domain flows. Exclude render styling, placement persistence, asset caching, SKU migration policy, and publication.

## Progress

Implemented: stable Shopify/WooCommerce source IDs, variant photos and landing links, explicit lookup errors, and project-backed feed/render URLs. Saved project snapshots now select the exact product or variant without upstream refetches, covered by end-to-end route regressions.

## Implementation guidance

Set `FeedRow.source_id` during every source mapping: Shopify variant ID, WooCommerce product ID, and deterministic imported-row identity. Keep exported `id` independent so existing Meta catalog/SKU behavior is not silently changed. `src/lib/renderProduct.ts` builds query parameters with URL encoding and selects exact source IDs before considering legacy handles.

Project feed URLs carry `projectId`, `templateId`, and `productId=source_id`. The render route loads the saved project and selects from its normalized products without an upstream request. If an explicit product ID is empty, unknown, or mismatched, return 400/404 and never use a handle fallback. Legacy handle lookup matches a complete product slug/ID only and returns 409 when multiple variants match.

Variant mapping in `src/lib/facebook.ts` chooses a featured/associated variant image before the product fallback and includes `?variant=<id>` in Shopify landing links. WooCommerce keeps its own identity path.

## Interfaces

`buildRenderUrl(templateId, projectOrDomain, row)` returns an encoded relative `/api/render` URL. `selectRenderProduct(rows, { productId, handle })` returns exactly one `FeedRow` or throws `ProductSelectionError` with an HTTP status. `source_id` is internal and excluded from `FB_HEADERS`/`rowsToCsv`.

The project/render URL contract is extended by later version tokens but must retain exact `productId` semantics. Unknown explicit IDs always take precedence over legacy handles and fail closed.

## Validation

`tests/renderProduct.test.ts` covers duplicate/mutable SKUs, stable source IDs, variant images/links, WooCommerce IDs, encoded legacy values, unknown IDs, and ambiguous handles. `tests/feed-render.test.ts` exercises feed-to-render round trips for Shopify variants and WooCommerce, project snapshot use, excluded products, and HTTP statuses.

Run `npm test`, `npm run typecheck`, and `npm run build`. Browser evidence should open two variants sharing one product handle and compare title, price, image, and landing link.

## Completion handoff

Reviewers should report source-ID construction per provider, exported-ID preservation, URL parameters, selection/error semantics, round-trip tests, and two-variant browser evidence. Future render URL changes must reuse `source_id` and keep the fail-closed behavior.
