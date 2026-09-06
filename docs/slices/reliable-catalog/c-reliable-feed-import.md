---
id: "c-reliable-feed-import"
slice: "reliable-catalog"
title: "Import CSV/XML without corrupting product data"
step: "connect"
status: "done"
effort: "M"
order: 8
tags: ["next"]
dependsOn: ["c-reliable-catalog-project"]
implementation: "specified"
value: "Imports your product lists correctly, including prices and sale details, so shoppers always see the right price and currency."
---

# Import CSV/XML without corrupting product data

## Summary

Fix quoted multiline CSV fields and locale-aware prices; preserve sale prices, currencies, and stable IDs across imported feeds.

## Acceptance criteria

- Quoted newlines, escaped quotes, BOMs, and supported CSV/TSV delimiters preserve column alignment.
- 17,90 EUR imports as 17.90 EUR, with explicit handling of ambiguous separators and missing currency.
- CSV and XML retain regular and sale prices; malformed rows produce actionable import errors.

## Scope

Own CSV/TSV and supported product-feed XML parsing, header aliases, normalized price strings, stable imported `source_id` values, and bounded remote feed retrieval. Preserve all rows by default; preview limiting is an explicit caller option. Exclude spreadsheet formats, arbitrary XML schemas, authenticated feeds, scheduled refresh, and source correction UI.

## Progress

Implemented: quoted multiline records, escaped quotes, BOM/CSV/TSV parsing, locale-aware separators, prefix or suffix ISO currency codes, regular and sale price preservation, stable source IDs, bounded streaming reads, redirect validation, and row-level findings from the shared validator. Missing currencies remain explicit and block readiness.

## Implementation guidance

Use `src/lib/feedImport.ts` for deterministic parsing and `src/lib/remoteFeed.ts` for network retrieval. The delimited parser must operate as a record state machine so newlines and escaped quotes inside quoted fields do not split rows. Strip a leading BOM, choose tab only when the header is tab-delimited without commas, and fail an unterminated quote instead of returning shifted data.

Normalize decimal commas and supported grouped/decimal separators to two-decimal amounts while preserving a prefix or suffix three-letter ISO currency. Missing or ambiguous currency remains missing for `validateCatalog` to reject; do not invent a store currency for uploaded feeds. XML parsing must decode supported entities, retain regular/sale prices, and produce deterministic source IDs.

Remote imports normalize and revalidate the initial URL and every redirect, reject embedded credentials and local/private hosts, cap redirect count and bytes, and abort oversized or timed-out responses. Return the final URL and detected format for the project source descriptor.

## Interfaces

`parseFeedCsv(text, sourceLabel?, limit?)` and `parseFeedXml(text, sourceLabel?, limit?)` return `FeedRow[]` or throw an actionable `Error`. `source_id` is deterministic within the source snapshot (`csv:row:<n>` or the XML item identity); exported `id` comes from source ID/SKU columns and is validated separately. Price normalization emits `"12.34 USD"` or an empty/unverified value.

`importRemoteFeed(url)` returns `{ url, format, rows }`. Keep `MAX_FEED_BYTES` as the shared request/project upload bound. Route errors must distinguish invalid input/size from upstream failures without echoing credentials or full feed content.

## Validation

`tests/feedImport.test.ts` covers BOMs, quoted newlines, escaped quotes, decimal commas, sale price retention, unterminated quotes, full import versus explicit preview limits, redirect revalidation, and declared oversized bodies. Add regressions for any new alias or XML form. Project tests prove all rows are persisted.

Run `npm test`, `npm run typecheck`, and `npm run build`. Manual evidence should use a small CSV and XML fixture containing the same sale product and compare normalized rows field by field.

## Completion handoff

Reviewers should report parser and network-boundary files, fixture cases, normalized row comparisons, and command results. Any newly supported schema or ambiguity policy must be documented here before code changes; cross-source identity changes require coordination with variant rendering and versioned render specs.
