Catalog Forge imports store catalogs and generates branded product images and Meta feeds.

## Story map and implementation specs

The `/story-map` page is generated from Markdown in `docs/slices/`. Cards link to in-app specs and copyable agent handoffs. Slice noteboards read individual Markdown files from each slice’s `notes/` directory; story pages and handoffs surface relevant notes. Shared status is maintained in the repository; browser storage holds view preferences only. See [the authoring guide](docs/story-map-authoring.md) and [story template](docs/templates/story.md) to add a slice or assign work. Run `npm run story-map:check` to validate metadata and dependency graphs. `npm run dev` watches content changes; production updates require a new build.

## Development checks

Fast local gate (runs story-map validation, tests, typecheck, then lint in order; stops at the first failure):

```bash
npm run check
```

Individual commands:

```bash
npm run story-map:check
npm test
npm run typecheck
npm run lint
```

Release-only gates (slower; need Cloudflare bindings for a faithful run):

```bash
npm run build
npm run cf:build
```

Generated output (`.next/`, `.open-next/`, `.wrangler/`, coverage, `src/story-map/generated.json`) is ignored by git and lint — never edit it. Exported PNGs render text with bundled Inter data (`src/editor/fonts.ts`, regenerated from `@fontsource/inter` with `npm run fonts`). A green build proves the app compiles; it does not prove anonymous Cloudflare access or Meta catalog acceptance. Those belong to the workflow proof story.

The Vitest regression suite uses local Shopify and WooCommerce fixtures. It exercises feed generation through product selection and the JSX passed to the image renderer; it does not contact real stores or validate raster appearance. Use `npm run test:watch` while developing.

The Customize and Feed health actions create a catalog project containing the source descriptor, full normalized product snapshot, selected placement, and template. Project data is stored under `catalog-projects/` in `TEMPLATES_BUCKET` on Cloudflare and in `/tmp/catalog-forge-projects.json` during `next dev` and tests. The editor, validator, feed, and image renderer reopen that snapshot through an unguessable `projectId`.

Production saves require the `TEMPLATES_BUCKET` R2 binding. A missing binding or failed R2 write returns a retryable `503` and leaves the editor draft unsaved; production never reads from process memory or `/tmp`. To exercise a local production build without Cloudflare, explicitly set `CATALOG_FORGE_ALLOW_LOCAL_STORAGE=true`. Templates and projects carry monotonic revisions, project updates reject stale editor revisions, and saved template reads use `Cache-Control: no-store`.

Cloudflare binding and runtime types are generated from `wrangler.jsonc`:

```bash
./node_modules/.bin/wrangler types worker-configuration.d.ts --env-interface CloudflareEnv
```

Generated image URLs use `projectId` plus `productId` (for example, `shopify:variant:123`). This immutable source ID is separate from the exported CSV `id`, which retains the existing SKU-based behavior. Legacy domain-based feeds remain supported.

Catalog validation runs across the full saved snapshot. The same grouped result is returned by previews and projects, displayed by the validator, and summarized in feed response headers (`X-Catalog-Validation`, `X-Catalog-Errors`, and `X-Catalog-Warnings`). Shopify currency comes from the storefront cart response; WooCommerce currency comes from Store API price data. Missing currency codes are preserved as validation errors rather than defaulting to EUR.

Legacy `handle` URLs still work when they identify exactly one row. Ambiguous references return HTTP 409; refresh the enriched feed to obtain variant-specific image URLs. Unknown explicit IDs return HTTP 404 and never fall back to a different variant.

## Deploy on Netlify (production)

The production app runs on Netlify's free plan; product data and image files stay in Cloudflare R2, reached over its S3-compatible API. Rasterization happens inside the serverless function, so no separate renderer service exists.

1. Create an R2 API token (Cloudflare dashboard → R2 → API tokens, object read/write on the two buckets below) and set these **server-side** environment variables in Netlify (never `NEXT_PUBLIC`, never committed):

| Variable | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token pair |
| `R2_TEMPLATES_BUCKET` | Drafts bucket name (e.g. `catalog-forge-templates`) |
| `R2_RENDERS_BUCKET` | Render cache bucket name (e.g. `catalog-forge-renders`) |
| `ADMIN_PASSWORD` | Editor login password |

2. Deploy: `netlify.toml` already points the build at `npm run build`. The owner-selected production address is `cataloghog.netlify.app`; custom-domain work is deferred.
3. Verify anonymously: publish a fixture project, fetch `/api/feed?projectId=…`, open one image URL twice (second response carries the same ETag from R2), and confirm `catalog-forge` admin pages still require login.
4. Watch the actual Netlify Free Legacy allowances (100 GB bandwidth and 300 build minutes observed on September 8) and Cloudflare R2 usage. See the [operations runbook](docs/research/external-render-service/runbook.md). The old Worker’s public/preview URLs are disabled and Git builds disconnected; Netlify is production.

Local development is unchanged (`npm run dev`, `/tmp` file fallbacks); set `CATALOG_FORGE_ALLOW_LOCAL_STORAGE=true` to exercise a local production build without Cloudflare.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
