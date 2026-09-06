---
id: "c-reliable-catalog-project"
slice: "reliable-catalog"
title: "Save a catalog project for every source"
step: "connect"
status: "done"
effort: "L"
order: 7
tags: ["next"]
dependsOn: []
implementation: "specified"
value: "Keeps your imported products saved when you move between pages or reload, so you never lose your work and can pick up where you left off."
---

# Save a catalog project for every source

## Summary

Give store imports, feed URLs, and uploaded CSVs a shared project that survives navigation and reloads. Imported files must work beyond the homepage preview.

## Acceptance criteria

- Persist source type, source location or uploaded data, normalized products, selected template, and publication settings under a project ID.
- Shopify, WooCommerce, feed URL, and CSV projects can be reopened and used by the editor, validator, and feed generator.
- Store full catalog data separately from preview limits; expose truncation or incomplete imports explicitly.

## Scope

Own the `CatalogProject` aggregate, unguessable project IDs, authenticated create/read/update routes, and durable project storage. Normalize every supported source into a complete saved `FeedRow[]`; raw CSV text is an import input and is not retained after normalization. Preserve source metadata needed to explain where the snapshot came from.

Publication history, placement collections, render caching, upstream refresh, and project listing/deletion are separate stories. Legacy projects without revision or validation fields remain readable.

## Progress

Implemented: unguessable project IDs persist the source descriptor, full normalized catalog, selected placement, and design. Shopify, WooCommerce, remote feeds, and CSV uploads reopen in the editor and validator; feeds and PNG renders read the saved snapshot. Safety-limit imports are marked incomplete.

## Implementation guidance

The implementation lives in `src/lib/catalogProject.ts`, `src/lib/catalogProjectStore.ts`, and `src/app/api/projects/route.ts`. Creation dispatches by `source.type`: `fetchStoreCatalog` for Shopify/WooCommerce, `importRemoteFeed` for feed URLs, and `parseFeedCsv` for uploads. Save the full normalized result while homepage preview limits remain presentation-only.

Use `newProjectId` and `sanitizeProjectId` at every boundary. Store JSON at `catalog-projects/<projectId>.json` in `TEMPLATES_BUCKET`; local files are development/test fallback only. Project reads used by the editor/validator are authenticated and `private, no-store`. Project-backed feeds/renders consume the saved snapshot and must not reimport the source.

## Interfaces

`CatalogProjectSource` is a discriminated union: store sources record normalized origin, platform, currency codes, and currency source; feed URLs record final validated URL and format; CSV records the bounded filename and format. `CatalogProject.importStatus` carries `complete`, source product count, normalized row count, and an optional warning. `products` contains every normalized row; `template`, `placement`, validation, timestamps, and optional revision travel with the aggregate.

`POST /api/projects` accepts `{ source, template, placement }` and returns project/template IDs, row/product counts, completeness, validation, and revisions. `GET /api/projects?id=…` returns the aggregate plus a current validation result. `PATCH` changes design/placement without replacing products and accepts `expectedRevision`.

## Validation

`tests/projects.test.ts` must prove a CSV larger than the preview limit persists every row, reports a late invalid row, reopens by ID, and updates design without replacing products. `tests/feed-render.test.ts` must prove feed/render routes use the snapshot without upstream fetches. Exercise invalid IDs, missing projects, all source variants, incomplete imports, and R2 read/write errors.

Run `npm test`, `npm run typecheck`, and `npm run build`. For Cloudflare evidence, create and reopen a project through the deployed Worker and confirm the R2 object rather than relying on process memory.

## Completion handoff

Reviewers should verify the model and route shapes above, the R2 key, authentication/no-store behavior, full-row regression, and project-backed feed/render regression. Report any compatibility change needed by placement or publication stories as a separate Reliable Catalog note; keep this story done unless its acceptance behavior regresses.
