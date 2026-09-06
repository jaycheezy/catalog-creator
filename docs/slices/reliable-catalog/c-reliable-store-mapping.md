---
id: "c-reliable-store-mapping"
slice: "reliable-catalog"
title: "Remove Gibun-specific catalog defaults"
step: "validate"
status: "done"
effort: "M"
order: 10
tags: ["next"]
dependsOn: ["c-reliable-catalog-project"]
implementation: "specified"
value: "Shows your true brand, prices and categories instead of generic labels, so your ads look like your shop."
---

# Remove Gibun-specific catalog defaults

## Summary

Map currencies, brands, and product categories from the selected catalog instead of labeling every Shopify product as EUR tea.

## Acceptance criteria

- Use a verified store currency or an explicit project setting; never silently assume EUR.
- Non-tea products do not receive the Tea category, and missing vendors do not become Gibun.
- Valid non-EUR prices pass validation and discount bindings retain the product currency.

## Scope

Own Shopify and WooCommerce discovery, normalization into `FeedRow`, verified currency provenance, brand/category mapping, variant images and links, and render-relevant binding values. Exclude private-store Admin APIs, inventory quantities, merchant overrides, taxonomy enrichment, and source writes.

## Progress

Implemented: Shopify currency is read from its Ajax cart response and WooCommerce currency from Store API prices; missing codes stay unverified rather than becoming EUR. Shopify categories no longer default to Tea, absent vendors remain missing, valid non-EUR rows pass, and discount amounts keep their source currency.

## Implementation guidance

Use `src/lib/storeCatalog.ts` to select a provider, `src/lib/shopify.ts` plus `src/lib/facebook.ts` for Shopify mapping, and `src/lib/woocommerce.ts` for WooCommerce. Provider detection must fail explicitly when neither supported API responds; it must not combine partial responses from different platforms.

For Shopify, fetch products through the public Products Ajax endpoint and obtain currency from the storefront cart response. For WooCommerce, use Store API price metadata. Record `currencyCodes` and `currencySource` on the project source. When the provider does not supply a verified code, keep prices without an invented suffix so shared validation blocks publication.

Preserve source vendor/brand and category values. Empty vendor remains empty; Shopify product type does not become a hard-coded Tea taxonomy. Map every physical variant independently, prefer its featured/associated image, and land on its exact variant URL.

## Interfaces

`fetchStoreCatalog(origin)` returns normalized rows, source product/row counts, selected platform, completeness, currency codes, and `currencySource: "shopify-cart" | "woocommerce-api" | "missing"`. Shopify rows use `shopify:variant:<id>` source IDs; WooCommerce rows use `woocommerce:product:<id>`.

Binding resolution in `src/editor/bindings.ts` derives discount percent/amount from canonical regular and sale prices and retains their currency. Mapping must not leak internal `source_id` into the exported CSV header.

## Validation

`tests/renderProduct.test.ts` covers non-EUR mapping, missing vendor/category defaults, variant images/links, WooCommerce IDs, and discount currency. `tests/feed-render.test.ts` covers both providers and a failed Shopify currency lookup. Add provider fixtures before changing response parsing.

Run `npm test`, `npm run typecheck`, and `npm run build`. A manual store smoke test should record platform, product/row counts, currency code/source, and the expected validation state without committing store credentials.

## Completion handoff

Reviewers should report provider fixtures, normalized row samples, currency provenance, exact variant links/images, and shared validation results. Any new platform or explicit currency override needs a separate contract and story; do not reopen this story to add unrelated source support.
