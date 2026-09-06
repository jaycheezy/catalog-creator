import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Architecture — Catalog Forge (internal)",
  description:
    "Internal documentation: data flow, services, storage, auth, and how everything works in Catalog Forge.",
};

const FLOW_STEPS = [
  {
    n: "1",
    title: "Import",
    subtitle: "Store · Feed URL · CSV",
    body: "Store: fetchStoreCatalog tries Shopify /products.json, falls back to WooCommerce Store API. Feed URL: importRemoteFeed fetches CSV/XML with SSRF guard, 8 MB / 15 s limits. CSV: parsed client-side.",
    files: ["src/lib/storeCatalog.ts", "src/lib/shopify.ts", "src/lib/woocommerce.ts", "src/lib/remoteFeed.ts", "src/lib/feedImport.ts"],
    routes: ["GET /api/preview?domain=", "GET /api/feed-import?url="],
  },
  {
    n: "2",
    title: "Normalize",
    subtitle: "→ FeedRow[]",
    body: "Variant expansion into canonical FeedRow rows. Stable SKU-based id for the CSV export, immutable source_id for rendering. Prices formatted as “NN.NN CUR”, sale_price from compare-at, links upgraded to https, descriptions stripped to 5000 chars.",
    files: ["src/lib/facebook.ts", "src/lib/platform.ts"],
    routes: [],
  },
  {
    n: "3",
    title: "Validate",
    subtitle: "blocked · needs-review · ready",
    body: "validateCatalog checks ids, titles, descriptions, brand, images, availability/condition values, price format, sale ordering, duplicate ids, and import completeness. Same result surfaces in preview UI, validator page, and X-Catalog-* feed headers.",
    files: ["src/lib/catalogValidation.ts"],
    routes: ["GET /api/preview", "GET /api/feed-import", "/validate"],
  },
  {
    n: "4",
    title: "Snapshot",
    subtitle: "CatalogProject",
    body: "POST /api/projects persists the full snapshot: source descriptor + normalized products + template + placement + validation + revision 1. Stored in R2 (catalog-projects/) or /tmp JSON locally. Unguessable prj_* id is the capability key.",
    files: ["src/lib/catalogProject.ts", "src/lib/catalogProjectStore.ts"],
    routes: ["POST /api/projects", "GET /api/projects?id=", "PATCH /api/projects"],
  },
  {
    n: "5",
    title: "Design",
    subtitle: "Template editor",
    body: "Layers (product-image / text / shape / badge) with {{bindings}} resolved per product. Per-size placementTemplates via adaptTemplateToSize. Saves use optimistic concurrency (expectedRevision → 409 on conflict); all placements validated before write.",
    files: ["src/editor/types.ts", "src/editor/bindings.ts", "src/editor/autoLayout.ts", "src/editor/renderElement.tsx"],
    routes: ["/editor", "PATCH /api/projects", "POST /api/templates"],
  },
  {
    n: "6",
    title: "Publish",
    subtitle: "Frozen publication",
    body: "POST /api/projects/publish deep-clones the draft into an immutable CatalogPublicationSnapshot. Error rows are skipped and recorded (skippedProductIds). Draft edits never leak into the live feed; failures preserve the previous active snapshot.",
    files: ["src/lib/catalogPublication.ts", "src/lib/catalogPublicationStore.ts"],
    routes: ["POST /api/projects/publish"],
  },
  {
    n: "7",
    title: "Feed",
    subtitle: "Meta CSV",
    body: "GET /api/feed?projectId= serves the frozen snapshot anonymously as Meta/Facebook CSV. Each image_link is rewritten to a versioned /api/render URL embedding productRevision + templateRevision + sizeId. Draft preview requires auth + ?draft=1.",
    files: ["src/app/api/feed/route.ts", "src/lib/renderProduct.ts"],
    routes: ["GET /api/feed"],
  },
  {
    n: "8",
    title: "Render",
    subtitle: "Satori → PNG → R2",
    body: "GET /api/render renders via Satori + resvg with bundled Inter fonts. On cache miss the PNG is written to RENDERS_BUCKET at renders/v2/… and served immutable (1 y). Stale revisions return 409; ?draft=1 bypasses cache and never touches R2.",
    files: ["src/app/api/render/route.tsx", "src/lib/renderCache.ts", "src/lib/renderCacheStore.ts", "src/editor/fonts.ts", "src/editor/renderStyles.ts"],
    routes: ["GET /api/render"],
  },
  {
    n: "9",
    title: "Consume",
    subtitle: "Meta crawler",
    body: "Meta fetches the public feed CSV, then fetches each versioned PNG server-to-server. No login; unguessable prj_*/tpl_* ids act as capability URLs.",
    files: [],
    routes: [],
  },
];

const API_ROWS: { route: string; auth: string; what: string }[] = [
  { route: "GET /api/preview?domain=", auth: "Login", what: "Live store import (Shopify → Woo fallback) + validation, first 50 rows. 30/min/IP, 5-min CDN cache." },
  { route: "GET /api/feed-import?url=", auth: "Login", what: "Remote CSV/XML import (200-row preview) + validation. 15/min/IP." },
  { route: "GET /api/feed", auth: "Public", what: "Meta CSV. ?domain= live, ?projectId= frozen publication (anonymous), ?draft=1 live draft (login)." },
  { route: "GET /api/render", auth: "Public", what: "Versioned PNG renderer, R2-backed immutable cache. 60/min/IP." },
  { route: "GET · POST · PATCH /api/projects", auth: "Login", what: "Project snapshot CRUD with revision-guarded writes." },
  { route: "POST /api/projects/publish", auth: "Login", what: "Freeze draft → immutable publication snapshot." },
  { route: "GET /api/templates?id= · POST", auth: "Mixed", what: "Legacy template store. Reads by id public, writes + listing need login." },
  { route: "GET /api/brand?domain=", auth: "Public", what: "Brand kit via api.context.dev or heuristic fallback (favicon + hash hue). 24 h cache." },
  { route: "GET · POST · DELETE /api/login", auth: "Public", what: "HMAC session cookie (30 d, HttpOnly/Lax). 10/min/IP." },
];

const PAGE_ROWS: { route: string; what: string }[] = [
  { route: "/", what: "Landing + import (store / feed / CSV tabs), brand + template + placement picker, creates project." },
  { route: "/editor", what: "Visual template editor: layers canvas, properties, AI-assist, all-sizes view, publish." },
  { route: "/validate", what: "Meta Feed Auditor: grouped issues, currency codes, affected product ids." },
  { route: "/story-map", what: "Internal agile board generated from docs/slices Markdown (local dev only, 404s in production)." },
  { route: "/architecture", what: "This page — internal data-flow and services documentation." },
  { route: "/login", what: "Password gate when ADMIN_PASSWORD is set." },
  { route: "/concepts", what: "Static design exploration (mock data only)." },
];

const LIB_ROWS: { file: string; role: string }[] = [
  { file: "lib/shopify.ts", role: "Shopify /products.json import (≤5000), currency via /cart.js" },
  { file: "lib/woocommerce.ts", role: "Woo Store API import (5×100), minor-units price conversion" },
  { file: "lib/storeCatalog.ts", role: "Unified import: Shopify → Woo fallback, single source for feed/render parity" },
  { file: "lib/platform.ts", role: "Platform detection + structured unsupported-platform help" },
  { file: "lib/facebook.ts", role: "FeedRow type, variant→row mapping, rowsToCsv" },
  { file: "lib/feedImport.ts · remoteFeed.ts", role: "CSV/XML parsing, SSRF guard, size/timeout limits" },
  { file: "lib/catalogValidation.ts", role: "blocked / needs-review / ready checks" },
  { file: "lib/catalogProject(.Store).ts", role: "Draft snapshot type + R2//tmp persistence" },
  { file: "lib/catalogPublication(.Store).ts", role: "Immutable publication type + persistence" },
  { file: "lib/templateStore.ts", role: "Legacy template persistence" },
  { file: "lib/renderProduct.ts", role: "Render URL builder, exact product selection (404/409)" },
  { file: "lib/renderCache(.Store).ts", role: "Asset identity (SHA-256 revisions), immutable R2 keys" },
  { file: "lib/r2Client.ts · durableStorage.ts", role: "Sole storage seam: S3-R2 → Cloudflare binding → local fallback; prod 503 without R2" },
  { file: "lib/auth.ts · proxy.ts", role: "ADMIN_PASSWORD gate, HMAC session, rate limits, public-route allowlist" },
  { file: "lib/brand.ts · demoTemplates.ts", role: "Heuristic brand kit + starter templates" },
  { file: "editor/", role: "Template engine: types, bindings, Satori JSX, geometry, fonts, canvas UI" },
];

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{kicker}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left">
            {head.map((h) => (
              <th key={h} className="border-b border-neutral-200 px-4 py-2.5 font-semibold text-neutral-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-neutral-50/50" : "bg-white"}>
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 align-top ${j === 0 ? "font-mono text-[13px] font-medium text-neutral-900" : "text-neutral-600"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ArchitecturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 text-neutral-900">
      <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
        ← Catalog Forge
      </Link>
      <p className="mt-6 inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
        Internal · team only
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">How Catalog Forge works</h1>
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-neutral-600">
        Data flow, services, storage, and auth — one page that explains the whole system. Store catalogs come in,
        get normalized and validated, are frozen into a project snapshot, designed against, published immutably,
        and served to Meta as a feed of versioned render URLs.
      </p>

      {/* Flow diagram */}
      <Section kicker="Data flow" title="The pipeline, end to end">
        <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[27px] before:top-4 before:w-px before:bg-neutral-200">
          {FLOW_STEPS.map((s) => (
            <li key={s.n} className="relative flex gap-4">
              <span className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-900 bg-neutral-900 text-xl font-bold text-white">
                {s.n}
              </span>
              <div className="flex-1 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <span className="text-sm font-medium text-neutral-500">{s.subtitle}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{s.body}</p>
                {s.routes.length > 0 && (
                  <p className="mt-2 text-[13px] text-neutral-500">
                    <span className="font-semibold text-neutral-700">Routes: </span>
                    {s.routes.map((r) => (
                      <code key={r} className="mr-1.5 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                        {r}
                      </code>
                    ))}
                  </p>
                )}
                {s.files.length > 0 && (
                  <p className="mt-1.5 text-[13px] text-neutral-500">
                    <span className="font-semibold text-neutral-700">Key files: </span>
                    {s.files.map((f) => (
                      <code key={f} className="mr-1.5 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                        {f}
                      </code>
                    ))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="Services" title="API routes">
        <Table head={["Route", "Auth", "What it does"]} rows={API_ROWS.map((r) => [r.route, r.auth, r.what])} />
      </Section>

      <Section kicker="Services" title="Pages">
        <Table head={["Route", "What it does"]} rows={PAGE_ROWS.map((r) => [r.route, r.what])} />
      </Section>

      <Section kicker="Codebase" title="Library & editor modules">
        <Table head={["Module", "Responsibility"]} rows={LIB_ROWS.map((r) => [r.file, r.role])} />
      </Section>

      <Section kicker="Infrastructure" title="Storage, auth & environments">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">Storage</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600">
              <li>
                <strong className="text-neutral-900">Production (Netlify):</strong> two R2 buckets reached over the
                S3-compatible API — templates bucket (templates + projects + publications) and renders bucket
                (immutable PNGs). Rasterization runs inside the serverless function (~1 s of a 10 s timeout).
              </li>
              <li>
                <strong className="text-neutral-900">Local dev / tests:</strong> <code className="font-mono text-[12px]">/tmp/catalog-forge-*.json</code> file
                fallbacks plus an in-memory render cache. Atomic tmp+rename writes.
              </li>
              <li>
                Missing R2 binding in production returns a retryable <code className="font-mono text-[12px]">503</code> —
                the app never silently writes to process memory or <code className="font-mono text-[12px]">/tmp</code> in
                prod (override: <code className="font-mono text-[12px]">CATALOG_FORGE_ALLOW_LOCAL_STORAGE=true</code>).
              </li>
              <li>
                Single storage seam: <code className="font-mono text-[12px]">lib/r2Client.ts</code> +{" "}
                <code className="font-mono text-[12px]">lib/durableStorage.ts</code>. Cloudflare Worker path
                (wrangler.jsonc + open-next) is the rollback target.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">Auth & limits</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600">
              <li>
                One <code className="font-mono text-[12px]">ADMIN_PASSWORD</code> env var → HMAC session cookie
                (30 days, HttpOnly/Lax). Unset means open dev mode.
              </li>
              <li>
                <strong className="text-neutral-900">Login required:</strong> pages (except /login), project/template
                writes, previews. <strong className="text-neutral-900">Public by design:</strong> /api/feed,
                /api/render, template reads by id — Meta must reach them without login.
              </li>
              <li>Unguessable prj_*/tpl_* ids act as capability URLs.</li>
              <li>Per-IP rate limits: preview/feed 30, feed-import 15, render 60, login 10 per minute.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="font-semibold">External services</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Shopify storefronts (<code className="font-mono text-[12px]">/products.json</code>,{" "}
            <code className="font-mono text-[12px]">/cart.js</code> for currency) · WooCommerce Store API (
            <code className="font-mono text-[12px]">/wp-json/wc/store/v1</code>) · arbitrary feed URLs (Google
            Shopping / Facebook CSV &amp; XML) · <code className="font-mono text-[12px]">api.context.dev</code> brand
            enrichment (optional key, heuristic favicon fallback) · Meta crawler (feed + image consumer).
          </p>
        </div>
      </Section>

      <Section kicker="Correctness" title="Invariants to preserve">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600">
          <li>Feed and render always resolve products through the same normalized snapshot (parity).</li>
          <li>Anonymous feed reads serve only the frozen publication — never the live draft.</li>
          <li>Render URLs are content-versioned (product + template revisions + size + renderer contract); cache is immutable.</li>
          <li>Project writes are atomic and revision-guarded; stale editor revisions are rejected with 409.</li>
          <li>Currency is never defaulted — missing codes stay validation errors.</li>
          <li>Unknown explicit product ids return 404 and never fall back to a different variant.</li>
        </ul>
      </Section>

      <footer className="mt-12 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
        <Link href="/story-map" className="font-medium text-neutral-700 hover:text-neutral-900">
          Story map →
        </Link>
        <Link href="/validate" className="font-medium text-neutral-700 hover:text-neutral-900">
          Feed validator →
        </Link>
        <Link href="/" className="font-medium text-neutral-700 hover:text-neutral-900">
          Import →
        </Link>
      </footer>
    </main>
  );
}
