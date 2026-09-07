import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Architecture — Catalog Forge (internal)",
  description:
    "Internal documentation: data flow, services, storage, auth, and how everything works in Catalog Forge.",
};

/* ---------------------------------- data ---------------------------------- */

type Endpoint = { method: string; path: string };

type FlowStep = {
  n: string;
  title: string;
  subtitle: string;
  body: string;
  endpoints: Endpoint[];
  files: string[];
};

const FLOW_STEPS: FlowStep[] = [
  {
    n: "1",
    title: "Import",
    subtitle: "Store · Feed URL · CSV",
    body: "Store imports try Shopify /products.json first, then fall back to the WooCommerce Store API. Feed URLs are fetched with SSRF guards and 8 MB / 15 s limits. CSVs are parsed client-side.",
    endpoints: [
      { method: "GET", path: "/api/preview?domain=" },
      { method: "GET", path: "/api/feed-import?url=" },
    ],
    files: ["lib/storeCatalog.ts", "lib/shopify.ts", "lib/woocommerce.ts", "lib/remoteFeed.ts", "lib/feedImport.ts"],
  },
  {
    n: "2",
    title: "Normalize",
    subtitle: "→ FeedRow[]",
    body: "Variants expand into canonical FeedRow rows. A stable SKU-based id feeds the CSV export while an immutable source_id drives rendering. Prices become “NN.NN CUR”, sale_price derives from compare-at, links upgrade to https.",
    endpoints: [],
    files: ["lib/facebook.ts", "lib/platform.ts"],
  },
  {
    n: "3",
    title: "Validate",
    subtitle: "blocked · needs-review · ready",
    body: "validateCatalog checks ids, titles, descriptions, brand, images, availability and condition values, price format, sale ordering, duplicate ids, and import completeness. The same result feeds previews, the validator UI, and X-Catalog-* feed headers.",
    endpoints: [
      { method: "GET", path: "/api/preview" },
      { method: "GET", path: "/api/feed-import" },
    ],
    files: ["lib/catalogValidation.ts"],
  },
  {
    n: "4",
    title: "Snapshot",
    subtitle: "CatalogProject · revision 1",
    body: "POST /api/projects persists the full snapshot — source descriptor, normalized products, template, placement, validation. Stored in R2 (catalog-projects/) or /tmp JSON locally. The unguessable prj_* id is the capability key.",
    endpoints: [
      { method: "POST", path: "/api/projects" },
      { method: "GET", path: "/api/projects?id=" },
      { method: "PATCH", path: "/api/projects" },
    ],
    files: ["lib/catalogProject.ts", "lib/catalogProjectStore.ts"],
  },
  {
    n: "5",
    title: "Design",
    subtitle: "Template editor",
    body: "Layers (product-image / text / shape / badge) resolve {{bindings}} per product. Per-size placementTemplates adapt via adaptTemplateToSize. Saves use optimistic concurrency — stale revisions get a 409.",
    endpoints: [
      { method: "PATCH", path: "/api/projects" },
      { method: "POST", path: "/api/templates" },
    ],
    files: ["editor/types.ts", "editor/bindings.ts", "editor/autoLayout.ts", "editor/renderElement.tsx"],
  },
  {
    n: "6",
    title: "Publish",
    subtitle: "Frozen publication",
    body: "Publishing deep-clones the draft into an immutable CatalogPublicationSnapshot. Error rows are skipped and recorded. Draft edits never leak into the live feed, and failures preserve the previous active snapshot.",
    endpoints: [{ method: "POST", path: "/api/projects/publish" }],
    files: ["lib/catalogPublication.ts", "lib/catalogPublicationStore.ts"],
  },
  {
    n: "7",
    title: "Feed",
    subtitle: "Meta CSV",
    body: "GET /api/feed?projectId= serves the frozen snapshot anonymously as Meta CSV. Each image_link is rewritten to a versioned /api/render URL carrying productRevision + templateRevision + sizeId. Draft preview needs auth + ?draft=1.",
    endpoints: [{ method: "GET", path: "/api/feed" }],
    files: ["app/api/feed/route.ts", "lib/renderProduct.ts"],
  },
  {
    n: "8",
    title: "Render",
    subtitle: "Satori → PNG → R2",
    body: "Renders via Satori + resvg with bundled Inter. Cache misses write to RENDERS_BUCKET at renders/v2/… and serve immutable for a year. Stale revisions return 409; ?draft=1 bypasses cache and never touches R2.",
    endpoints: [{ method: "GET", path: "/api/render" }],
    files: ["app/api/render/route.tsx", "lib/renderCache.ts", "lib/renderCacheStore.ts", "editor/fonts.ts"],
  },
  {
    n: "9",
    title: "Consume",
    subtitle: "Meta crawler",
    body: "Meta fetches the public feed CSV, then each versioned PNG server-to-server. No login — the unguessable prj_*/tpl_* ids act as capability URLs.",
    endpoints: [],
    files: [],
  },
];

type ApiRow = { method: string; path: string; auth: "Public" | "Login" | "Mixed"; what: string };

const API_ROWS: ApiRow[] = [
  { method: "GET", path: "/api/preview?domain=", auth: "Login", what: "Live store import (Shopify → Woo fallback) + validation, first 50 rows. 30/min/IP, 5-min CDN cache." },
  { method: "GET", path: "/api/feed-import?url=", auth: "Login", what: "Remote CSV/XML import (200-row preview) + validation. 15/min/IP." },
  { method: "GET", path: "/api/feed", auth: "Public", what: "Meta CSV. ?domain= live · ?projectId= frozen publication (anonymous) · ?draft=1 live draft (login)." },
  { method: "GET", path: "/api/render", auth: "Public", what: "Versioned PNG renderer with R2-backed immutable cache. 60/min/IP." },
  { method: "PATCH", path: "/api/projects", auth: "Login", what: "Project snapshot CRUD (GET · POST · PATCH) with revision-guarded writes." },
  { method: "POST", path: "/api/projects/publish", auth: "Login", what: "Freeze draft → immutable publication snapshot." },
  { method: "GET", path: "/api/templates?id=", auth: "Mixed", what: "Legacy template store. Reads by id are public; writes + listing need login." },
  { method: "GET", path: "/api/brand?domain=", auth: "Public", what: "Brand kit via api.context.dev or heuristic fallback. 24 h cache." },
  { method: "POST", path: "/api/login", auth: "Public", what: "HMAC session cookie (30 d, HttpOnly/Lax). 10/min/IP." },
];

const PAGE_ROWS = [
  { route: "/", what: "Landing + import (store / feed / CSV), brand + template + placement picker, creates the project." },
  { route: "/editor", what: "Visual template editor: layers canvas, properties, AI-assist, all-sizes view, publish." },
  { route: "/validate", what: "Meta Feed Auditor: grouped issues, currency codes, affected product ids." },
  { route: "/story-map", what: "Agile board generated from docs/slices Markdown (dev only)." },
  { route: "/architecture", what: "This page — data flow and services reference (dev only)." },
  { route: "/login", what: "Password gate when ADMIN_PASSWORD is set." },
  { route: "/concepts", what: "Static design exploration (mock data only)." },
];

const LIB_ROWS = [
  { file: "lib/shopify.ts", role: "Shopify /products.json import (≤5000), currency via /cart.js" },
  { file: "lib/woocommerce.ts", role: "Woo Store API import (5×100), minor-units price conversion" },
  { file: "lib/storeCatalog.ts", role: "Unified import: Shopify → Woo fallback; single source for feed/render parity" },
  { file: "lib/platform.ts", role: "Platform detection + structured unsupported-platform help" },
  { file: "lib/facebook.ts", role: "FeedRow type, variant→row mapping, rowsToCsv" },
  { file: "lib/feedImport.ts · remoteFeed.ts", role: "CSV/XML parsing, SSRF guard, size/timeout limits" },
  { file: "lib/catalogValidation.ts", role: "blocked / needs-review / ready checks" },
  { file: "lib/catalogProject(.Store).ts", role: "Draft snapshot type + R2//tmp persistence" },
  { file: "lib/catalogPublication(.Store).ts", role: "Immutable publication type + persistence" },
  { file: "lib/templateStore.ts", role: "Legacy template persistence" },
  { file: "lib/renderProduct.ts", role: "Render URL builder, exact product selection (404/409)" },
  { file: "lib/renderCache(.Store).ts", role: "Asset identity (SHA-256 revisions), immutable R2 keys" },
  { file: "lib/r2Client.ts · durableStorage.ts", role: "Sole storage seam: S3-R2 → binding → local fallback; prod 503 without R2" },
  { file: "lib/auth.ts · proxy.ts", role: "ADMIN_PASSWORD gate, HMAC session, rate limits, public-route allowlist" },
  { file: "lib/brand.ts · demoTemplates.ts", role: "Heuristic brand kit + starter templates" },
  { file: "editor/", role: "Template engine: types, bindings, Satori JSX, geometry, fonts, canvas UI" },
];

const NAV = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#api", label: "API reference" },
  { href: "#pages", label: "Pages" },
  { href: "#modules", label: "Modules" },
  { href: "#infrastructure", label: "Infrastructure" },
  { href: "#invariants", label: "Invariants" },
];

/* -------------------------------- components ------------------------------- */

function MethodPill({ method }: { method: string }) {
  const color =
    method === "GET"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : method === "POST"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : method === "PATCH"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : method === "DELETE"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide ring-1 ring-inset ${color}`}>
      {method}
    </span>
  );
}

function AuthPill({ auth }: { auth: ApiRow["auth"] }) {
  const color =
    auth === "Public"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : auth === "Login"
        ? "bg-amber-50 text-amber-800 ring-amber-600/20"
        : "bg-slate-100 text-slate-600 ring-slate-500/20";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${auth === "Public" ? "bg-emerald-500" : auth === "Login" ? "bg-amber-500" : "bg-slate-400"}`} />
      {auth}
    </span>
  );
}

function EndpointLine({ method, path }: Endpoint) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 py-1 pl-1.5 pr-2.5 ring-1 ring-inset ring-slate-900/5">
      <MethodPill method={method} />
      <code className="truncate font-mono text-xs text-slate-700">{path}</code>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" className="fill-emerald-50 stroke-emerald-200" strokeWidth="1" />
      <path d="M5.5 8.2 7.2 10l3.3-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ----------------------------------- page ---------------------------------- */

export default function ArchitecturePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
              <span aria-hidden>←</span> Catalog Forge
            </Link>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" />
            <span className="hidden text-sm text-slate-400 sm:block">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Internal · dev only
            </span>
            <Link
              href="/story-map"
              className="hidden rounded-lg bg-slate-950 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:block"
            >
              Story map
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 320px at 15% -10%, rgba(99,91,255,0.55), transparent 60%), radial-gradient(500px 300px at 85% 0%, rgba(0,212,255,0.35), transparent 60%), radial-gradient(700px 400px at 50% 120%, rgba(99,91,255,0.25), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 100% at 50% 0%, black 40%, transparent 100%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Architecture · data flow</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            How Catalog Forge works
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Store catalogs come in, get normalized and validated, freeze into a project snapshot, get designed
            against, publish immutably — and go out to Meta as a feed of versioned render URLs.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="gap-10 py-10 lg:flex">
          {/* Sidebar */}
          <aside className="mb-8 shrink-0 lg:mb-0 lg:w-56">
            <nav className="lg:sticky lg:top-20">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">On this page</p>
              <ul className="mt-2 space-y-0.5">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-950 hover:shadow-sm hover:ring-1 hover:ring-slate-900/5"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">New here?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-indigo-900/70">
                  Follow the pipeline top to bottom — each step lists its endpoints and source files.
                </p>
              </div>
            </nav>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1">
            {/* Pipeline */}
            <section id="pipeline" className="scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Data flow</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">The pipeline, end to end</h2>
              <ol className="relative mt-6 space-y-4 before:absolute before:bottom-6 before:left-[26px] before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-indigo-300 before:via-indigo-200 before:to-cyan-200">
                {FLOW_STEPS.map((s) => (
                  <li key={s.n} className="relative flex gap-4">
                    <span className="z-10 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#635bff] to-[#3a2fd6] text-lg font-bold text-white shadow-lg shadow-indigo-600/25 ring-4 ring-[#f6f9fc]">
                      {s.n}
                    </span>
                    <article className="min-w-0 flex-1 rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)] transition hover:shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_32px_-12px_rgba(99,91,255,0.25)] sm:p-6">
                      <div className="flex flex-wrap items-baseline gap-x-2.5">
                        <h3 className="text-[17px] font-bold tracking-tight">{s.title}</h3>
                        <span className="text-[13px] font-medium text-slate-400">{s.subtitle}</span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{s.body}</p>
                      {s.endpoints.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap gap-1.5">
                          {s.endpoints.map((e) => (
                            <EndpointLine key={e.method + e.path} method={e.method} path={e.path} />
                          ))}
                        </div>
                      )}
                      {s.files.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {s.files.map((f) => (
                            <code key={f} className="rounded-md border border-slate-900/[0.06] bg-slate-50 px-1.5 py-0.5 font-mono text-[11.5px] text-slate-500">
                              {f}
                            </code>
                          ))}
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
            </section>

            {/* API reference */}
            <section id="api" className="mt-14 scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Services</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">API reference</h2>
              <p className="mt-2 max-w-2xl text-[15px] text-slate-500">
                Human writes need login; machine reads stay public so Meta can reach them without a session.
              </p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
                <div className="hidden grid-cols-[220px_110px_1fr] gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:grid">
                  <span>Endpoint</span>
                  <span>Access</span>
                  <span>What it does</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {API_ROWS.map((r) => (
                    <li key={r.method + r.path} className="grid gap-2 px-5 py-3.5 transition hover:bg-indigo-50/40 md:grid-cols-[220px_110px_1fr] md:items-center md:gap-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MethodPill method={r.method} />
                        <code className="truncate font-mono text-[13px] font-medium text-slate-800">{r.path}</code>
                      </span>
                      <span>
                        <AuthPill auth={r.auth} />
                      </span>
                      <span className="text-sm leading-relaxed text-slate-600">{r.what}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Pages */}
            <section id="pages" className="mt-14 scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Services</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Pages</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PAGE_ROWS.map((p) => (
                  <div
                    key={p.route}
                    className="group rounded-2xl border border-slate-900/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(99,91,255,0.3)]"
                  >
                    <code className="inline-block rounded-lg bg-slate-950 px-2 py-1 font-mono text-xs font-semibold text-white">
                      {p.route}
                    </code>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.what}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Modules */}
            <section id="modules" className="mt-14 scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Codebase</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Library & editor modules</h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <ul className="divide-y divide-slate-100">
                  {LIB_ROWS.map((m) => (
                    <li key={m.file} className="flex flex-col gap-1 px-5 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-baseline sm:gap-4">
                      <code className="shrink-0 font-mono text-[13px] font-semibold text-indigo-700 sm:w-64">{m.file}</code>
                      <span className="text-sm text-slate-600">{m.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Infrastructure */}
            <section id="infrastructure" className="mt-14 scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Infrastructure</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Storage, auth & environments</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-600/25">
                    <svg viewBox="0 0 20 20" className="h-5 w-5 text-white" fill="none" aria-hidden>
                      <ellipse cx="10" cy="5" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <h3 className="mt-3 font-bold">Storage</h3>
                  <ul className="mt-2 space-y-2.5 text-sm leading-relaxed text-slate-600">
                    <li>
                      <strong className="font-semibold text-slate-900">Production (Netlify):</strong> two R2 buckets
                      over the S3-compatible API — a templates bucket (templates + projects + publications) and a
                      renders bucket (immutable PNGs). Rasterization runs inside the serverless function.
                    </li>
                    <li>
                      <strong className="font-semibold text-slate-900">Local dev / tests:</strong>{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">/tmp/catalog-forge-*.json</code>{" "}
                      fallbacks plus an in-memory render cache. Atomic tmp+rename writes.
                    </li>
                    <li>
                      Missing R2 in production returns a retryable{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">503</code> — never a silent
                      local write.
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-600/25">
                    <svg viewBox="0 0 20 20" className="h-5 w-5 text-white" fill="none" aria-hidden>
                      <rect x="4" y="8.5" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M7 8.5V6.8a3 3 0 0 1 6 0v1.7" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <h3 className="mt-3 font-bold">Auth & limits</h3>
                  <ul className="mt-2 space-y-2.5 text-sm leading-relaxed text-slate-600">
                    <li>
                      One <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">ADMIN_PASSWORD</code> →
                      HMAC session cookie (30 d, HttpOnly/Lax). Unset means open dev mode.
                    </li>
                    <li>
                      <strong className="font-semibold text-slate-900">Login required:</strong> pages, project/template
                      writes, previews. <strong className="font-semibold text-slate-900">Public by design:</strong>{" "}
                      /api/feed, /api/render, template reads by id.
                    </li>
                    <li>
                      Unguessable <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">prj_*/tpl_*</code>{" "}
                      ids act as capability URLs. Per-IP limits: preview/feed 30, feed-import 15, render 60, login 10/min.
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <h3 className="font-bold">External services</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Shopify storefronts", "/products.json + /cart.js", "WooCommerce Store API", "Feed URLs (CSV/XML)", "api.context.dev", "Google favicon fallback", "Meta crawler"].map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600 ring-1 ring-inset ring-slate-900/5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Invariants */}
            <section id="invariants" className="mt-14 scroll-mt-20">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Correctness</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Invariants to preserve</h2>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Feed and render always resolve products through the same normalized snapshot (parity).",
                  "Anonymous feed reads serve only the frozen publication — never the live draft.",
                  "Render URLs are content-versioned (product + template revisions + size + renderer contract); cache is immutable.",
                  "Project writes are atomic and revision-guarded; stale editor revisions are rejected with 409.",
                  "Currency is never defaulted — missing codes stay validation errors.",
                  "Unknown explicit product ids return 404 and never fall back to a different variant.",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2.5 rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700"
                  >
                    <CheckIcon />
                    {t}
                  </li>
                ))}
              </ul>
            </section>

            {/* Footer nav */}
            <footer className="mt-14 grid gap-3 border-t border-slate-900/10 pt-6 sm:grid-cols-3">
              {[
                { href: "/story-map", k: "Internal", t: "Story map" },
                { href: "/validate", k: "Tool", t: "Feed validator" },
                { href: "/", k: "Start", t: "Import" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group rounded-2xl border border-slate-900/[0.07] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{l.k}</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {l.t} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </p>
                </Link>
              ))}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
