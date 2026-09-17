"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type StageKey = "all" | "import" | "shape" | "workspace" | "serve";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "import", label: "1 · Import" },
  { key: "shape", label: "2 · Shape" },
  { key: "workspace", label: "3 · Workspace" },
  { key: "serve", label: "4 · Serve" },
];

const SANS = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* ByteByteGo-ish pastel node palette */
const C = {
  green: { fill: "#dcfce7", stroke: "#16a34a" },
  blue: { fill: "#dbeafe", stroke: "#2563eb" },
  yellow: { fill: "#fef3c7", stroke: "#d97706" },
  violet: { fill: "#ede9fe", stroke: "#7c3aed" },
  pink: { fill: "#fce7f3", stroke: "#db2777" },
  white: { fill: "#ffffff", stroke: "#64748b" },
  slate: { fill: "#f1f5f9", stroke: "#94a3b8" },
} as const;

/* Plain-English explainers for each box (1–2 short paragraphs each). */
const INFO: Record<string, { title: string; body: string[] }> = {
  shopify: {
    title: "Shopify",
    body: [
      "The first import attempt for store catalogs. It reads up to 5,000 products from the store's /products.json endpoint and picks up the currency from /cart.js.",
      "If the store isn't on Shopify, or the fetch fails, the importer automatically falls back to WooCommerce — the merchant never has to choose.",
    ],
  },
  woo: {
    title: "WooCommerce",
    body: [
      "The fallback importer, used when Shopify doesn't pan out. It pages through the WooCommerce Store API (5 pages of 100 products) and converts prices from minor units.",
      "If neither platform matches, the UI shows structured help explaining what's unsupported instead of a bare error.",
    ],
  },
  feedurl: {
    title: "Feed URL",
    body: [
      "An existing remote CSV or XML catalog fetched server-side. Requests run through SSRF guards with an 8 MB size cap and a 15-second timeout, so a malicious or giant URL can't hurt the server.",
      "Only the first 200 rows are pulled back for preview before a project is created.",
    ],
  },
  csv: {
    title: "CSV upload",
    body: [
      "A spreadsheet file dropped or selected in the browser and parsed client-side into rows. Nothing is uploaded or stored until the merchant creates a project from it.",
      "It's the fastest route for quick experiments, offline edits, or catalogs that live in Excel.",
    ],
  },
  preview: {
    title: "GET /api/preview",
    body: [
      "The login-only endpoint behind the store-import UI. It runs the Shopify → WooCommerce chain, normalizes and validates the result, and returns the first 50 rows with their validation state.",
      "It's rate-limited (30/min per IP) and CDN-cached for 5 minutes, since live store imports are the most expensive reads in the app.",
    ],
  },
  feedimport: {
    title: "GET /api/feed-import",
    body: [
      "The login-only endpoint behind remote-URL imports. It fetches the CSV or XML feed, parses it, and returns a 200-row preview annotated with validation issues.",
      "Rate-limited to 15/min per IP to keep large feed fetches from being abused.",
    ],
  },
  auth: {
    title: "Auth gate",
    body: [
      "One ADMIN_PASSWORD mints an HMAC-signed session cookie (30 days, HttpOnly, Lax). When no password is set, the app runs in open dev mode.",
      "The rule is simple: human writes and previews need a login, while machine reads (feed, render) stay public so Meta's crawler never needs a session.",
    ],
  },
  limits: {
    title: "Rate limits",
    body: [
      "Per-IP guards on the expensive routes: store preview and feed at 30, feed imports at 15, renders at 60, and logins at 10 requests per minute.",
      "The caps are generous enough for real merchants and crawlers, but tight enough to blunt scraping and abuse.",
    ],
  },
  normalize: {
    title: "Normalize",
    body: [
      "Expands product variants into canonical FeedRow rows — one row per sellable variant. Each row gets a stable SKU-based id for the CSV export plus an immutable source_id that drives rendering.",
      "Prices are formatted as “NN.NN CUR”, sale prices derive from compare-at values, and links are upgraded to https.",
    ],
  },
  validate: {
    title: "Validate",
    body: [
      "Grades every row as blocked, needs-review, or ready. It checks ids, titles, descriptions, brand, images, availability and condition values, price format, sale ordering, duplicate ids, and import completeness.",
      "The same result feeds the live previews, the Feed Auditor UI, and the X-Catalog-* headers on feed responses. Currency is never defaulted — a missing code stays an error.",
    ],
  },
  postprojects: {
    title: "POST /api/projects",
    body: [
      "Persists the full snapshot — source descriptor, normalized products, template, placement, and validation — to R2 in production (or /tmp JSON locally).",
      "It returns an unguessable prj_* id that acts as the capability key for everything downstream. Writes are revision-guarded, so a stale editor tab gets a 409 instead of silently overwriting.",
    ],
  },
  project: {
    title: "CatalogProject · draft",
    body: [
      "The mutable workspace snapshot at revision N. Every editor save PATCHes it with optimistic concurrency, bumping the revision on success.",
      "Drafts are strictly private to the logged-in merchant: anonymous feed readers can never see a draft, only the frozen publication.",
    ],
  },
  editor: {
    title: "Template editor",
    body: [
      "The visual designer. Layers — product images, text, shapes, badges — carry {{bindings}} that resolve per product, and per-size placements adapt automatically to each ad dimension.",
      "Checking work-in-progress uses ?draft=1 renders, which require login and deliberately bypass the R2 cache so iteration is instant and never pollutes production.",
    ],
  },
  publish: {
    title: "POST …/publish",
    body: [
      "Freezes the draft by deep-cloning it into an immutable publication snapshot. Rows that fail validation are skipped and recorded rather than blocking the whole publish.",
      "If publishing fails, the previous active snapshot stays live. And edits made after publishing never leak into the feed until the next publish.",
    ],
  },
  publication: {
    title: "CatalogPublication",
    body: [
      "The frozen, anonymously readable snapshot. Feed and render resolve products exclusively through it — never the live draft.",
      "That single rule is what makes the system predictable: what Meta sees is byte-for-byte what was published, no matter how much the draft keeps changing.",
    ],
  },
  feed: {
    title: "GET /api/feed",
    body: [
      "Serves the frozen publication as a Meta-compatible CSV to anyone holding the link — no login. Each row's image_link is rewritten to a versioned /api/render URL.",
      "A draft preview of the same feed needs a login plus ?draft=1, keeping unfinished work out of crawlers' reach.",
    ],
  },
  imagelink: {
    title: "versioned image_link",
    body: [
      "Every render URL carries the product revision, template revision, and size id. Any content or design change therefore produces a brand-new URL.",
      "Unchanged images keep their URLs, so Meta's cache and the R2 cache stay warm — only edited products re-render.",
    ],
  },
  render: {
    title: "GET /api/render",
    body: [
      "Renders product cards with Satori and resvg using bundled Inter fonts — the exact same JSX renderer as the editor preview, so what you design is what Meta gets.",
      "Cache misses rasterize inside the serverless function and store the PNG; hits serve with year-long immutable caching. Limited to 60/min per IP.",
    ],
  },
  r2: {
    title: "Renders bucket (R2)",
    body: [
      "The immutable PNG cache under renders/v2/…, keyed by a hash of the content revisions. Keys are never overwritten: a new revision writes a new key.",
      "Because URLs are content-addressed, CDN and Meta caches physically cannot serve a stale image for a fresh URL.",
    ],
  },
  meta: {
    title: "Meta crawler",
    body: [
      "Meta fetches the public CSV feed, then downloads each PNG server-to-server to build the catalog ads. No session or login is ever involved.",
      "Security comes from unguessability: the prj_*/tpl_* ids in the URLs act as capability URLs — random enough that they can't be enumerated.",
    ],
  },
};

/* Key source files per step (paths verified against the repo). Empty = external step. */
const INFO_FILES: Record<string, string[]> = {
  shopify: ["lib/shopify.ts", "lib/storeCatalog.ts"],
  woo: ["lib/woocommerce.ts", "lib/storeCatalog.ts"],
  feedurl: ["lib/remoteFeed.ts", "lib/feedImport.ts"],
  csv: ["lib/feedImport.ts"],
  preview: ["app/api/preview/route.ts", "lib/storeCatalog.ts"],
  feedimport: ["app/api/feed-import/route.ts", "lib/feedImport.ts"],
  auth: ["lib/auth.ts", "proxy.ts"],
  limits: ["proxy.ts", "lib/auth.ts"],
  normalize: ["lib/facebook.ts", "lib/platform.ts"],
  validate: ["lib/catalogValidation.ts"],
  postprojects: ["app/api/projects/route.ts", "lib/catalogProject.ts", "lib/catalogProjectStore.ts"],
  project: ["lib/catalogProject.ts", "lib/catalogProjectStore.ts"],
  editor: ["editor/types.ts", "editor/bindings.ts", "editor/autoLayout.ts", "editor/renderElement.tsx"],
  publish: ["app/api/projects/publish/route.ts", "lib/catalogPublication.ts", "lib/catalogPublicationStore.ts"],
  publication: ["lib/catalogPublication.ts", "lib/catalogPublicationStore.ts"],
  feed: ["app/api/feed/route.ts", "lib/renderProduct.ts"],
  imagelink: ["lib/renderProduct.ts"],
  render: ["app/api/render/route.tsx", "lib/renderCache.ts", "lib/renderCacheStore.ts"],
  r2: ["lib/renderCacheStore.ts", "lib/r2Client.ts"],
  meta: [],
};

type DotApi = {
  isActive: (id: string) => boolean;
  enter: (id: string, el: SVGGElement) => void;
  leave: () => void;
  toggle: (id: string, el: SVGGElement) => void;
  dismiss: () => void;
};

function InfoDot({
  x,
  y,
  id,
  label,
  dotApi,
}: {
  x: number;
  y: number;
  id: string;
  label: string;
  dotApi: DotApi;
}) {
  const active = dotApi.isActive(id);
  return (
    <g
      className={`arch-info${active ? " is-active" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`About ${label}`}
      aria-expanded={active}
      onMouseEnter={(e) => dotApi.enter(id, e.currentTarget)}
      onMouseLeave={() => dotApi.leave()}
      onFocus={(e) => dotApi.enter(id, e.currentTarget)}
      onBlur={() => dotApi.leave()}
      onClick={(e) => {
        e.stopPropagation();
        dotApi.toggle(id, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dotApi.toggle(id, e.currentTarget);
        } else if (e.key === "Escape") {
          dotApi.dismiss();
          e.currentTarget.blur();
        }
      }}
      transform={`translate(${x},${y})`}
    >
      {/* NOTE: no <title> here on purpose — a native tooltip would pop up
          on top of the custom InfoTip card. aria-label covers assistive tech. */}
      <circle r={17} fill="transparent" />
      <circle r={10} className="arch-info-ring" />
      <text y={4} textAnchor="middle" fontFamily={SANS} fontSize={11.5} fontWeight={800} className="arch-info-glyph">
        i
      </text>
    </g>
  );
}

function StagePill({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x} y={0} width={150} height={30} rx={15} fill="#0f172a" />
      <text
        x={x + 75}
        y={19.5}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={12.5}
        fontWeight={800}
        fill="#fff"
      >
        {label}
      </text>
    </g>
  );
}

function Band({
  y,
  h,
  tint,
  children,
  opacity = 1,
}: {
  y: number;
  h: number;
  tint: string;
  children: React.ReactNode;
  opacity?: number;
}) {
  return (
    <g style={{ opacity, transition: "opacity .2s" }}>
      <rect
        x={16}
        y={y}
        width={928}
        height={h}
        rx={18}
        fill={tint}
        stroke="#cbd5e1"
        strokeWidth={2}
        strokeDasharray="9 7"
      />
      {children}
    </g>
  );
}

function Node({
  x,
  y,
  w,
  h,
  title,
  lines,
  color,
  titleSize = 13,
  tip,
  infoId,
  dotApi,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  color: keyof typeof C;
  titleSize?: number;
  tip?: string;
  infoId: string;
  dotApi: DotApi;
}) {
  const c = C[color];
  const active = dotApi.isActive(infoId);
  return (
    <g className={`arch-node${active ? " is-active" : ""}`}>
      {/* NOTE: <desc>, not <title> — screen readers announce it, but browsers
          never show it as a hover tooltip over the custom InfoTip card. */}
      {tip ? <desc>{tip}</desc> : null}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={c.fill}
        stroke={active ? "#0f172a" : c.stroke}
        strokeWidth={active ? 3 : 1.8}
      />
      <text
        x={x + w / 2}
        y={y + 26}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={titleSize}
        fontWeight={800}
        fill="#0f172a"
      >
        {title}
      </text>
      {lines.map((l, i) => (
        <text
          key={l}
          x={x + w / 2}
          y={y + 46 + i * 17}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={11}
          fill="#475569"
        >
          {l}
        </text>
      ))}
      <InfoDot x={x + w - 22} y={y + 22} id={infoId} label={title} dotApi={dotApi} />
    </g>
  );
}

function EdgeLabel({
  x,
  y,
  anchor = "middle",
  children,
}: {
  x: number;
  y: number;
  anchor?: "middle" | "start" | "end";
  children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={MONO}
      fontSize={11.5}
      fill="#334155"
      stroke="#fff"
      strokeWidth={5}
      style={{ paintOrder: "stroke" }}
    >
      {children}
    </text>
  );
}

function StepBadge({ x, y, n }: { x: number; y: number; n: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill="#0f172a" stroke="#fff" strokeWidth={2.5} />
      <text
        x={x}
        y={y + 3.8}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={11}
        fontWeight={800}
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

function TimeMark({ y }: { y: number }) {
  return (
    <text x={44} y={y} fontFamily={MONO} fontSize={11.5} fill="#94a3b8">
      time ↓
    </text>
  );
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Position a fixed tooltip next to an SVG dot, flipping to stay in-viewport. */
function tipPlacement(el: SVGGElement, h: number) {
  const r = el.getBoundingClientRect();
  const W = 288;
  const GAP = 12;
  let x = r.right + GAP;
  if (x + W > window.innerWidth - 8) x = r.left - W - GAP;
  if (x < 8) x = Math.max(8, window.innerWidth - W - 8);
  const y = Math.max(8, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - 8));
  return { x, y };
}

function InfoTip({
  anchorEl,
  id,
  onClose,
}: {
  anchorEl: SVGGElement;
  id: string;
  onClose: () => void;
}) {
  const info = INFO[id];
  const files = INFO_FILES[id] ?? [];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() =>
    typeof window === "undefined" ? { x: 0, y: 0 } : tipPlacement(anchorEl, 300),
  );
  // Track the anchor across scroll/resize so a pinned tip sticks to its dot.
  useIsoLayoutEffect(() => {
    const update = () => setPos(tipPlacement(anchorEl, ref.current?.offsetHeight ?? 300));
    update();
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [anchorEl, id]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={info.title}
      className="arch-tip fixed z-50 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-extrabold text-white"
          >
            i
          </span>
          {info.title}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explanation"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      {info.body.map((p) => (
        <p key={p.slice(0, 32)} className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          {p}
        </p>
      ))}
      {files.length > 0 && (
        <div className="mt-2.5 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Key files</p>
          <ul className="mt-1 space-y-0.5">
            {files.map((f) => (
              <li key={f} title={f} className="truncate font-mono text-[11px] text-indigo-700">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ArchitectureDiagram() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);
  const [sel, setSel] = useState<StageKey>("all");
  const [hoverTip, setHoverTip] = useState<{ id: string; el: SVGGElement } | null>(null);
  const [pinnedTip, setPinnedTip] = useState<{ id: string; el: SVGGElement } | null>(null);
  const visibleTip = hoverTip ?? pinnedTip;

  const dotApi: DotApi = {
    isActive: (id) => visibleTip?.id === id,
    enter: (id, el) => setHoverTip({ id, el }),
    leave: () => setHoverTip(null),
    toggle: (id, el) => {
      setHoverTip(null);
      setPinnedTip((cur) => (cur?.id === id ? null : { id, el }));
    },
    dismiss: () => {
      setHoverTip(null);
      setPinnedTip(null);
    },
  };

  // Hover tips are transient — drop them on scroll/resize. Pinned tips reposition themselves.
  useEffect(() => {
    if (!hoverTip) return;
    const clear = () => setHoverTip(null);
    window.addEventListener("scroll", clear, { capture: true, passive: true });
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, { capture: true });
      window.removeEventListener("resize", clear);
    };
  }, [hoverTip]);

  // Pinned tips: Escape or click-away dismisses.
  useEffect(() => {
    if (!pinnedTip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedTip(null);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && !t.closest(".arch-info, .arch-tip")) {
        setPinnedTip(null);
        setHoverTip(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
    };
  }, [pinnedTip]);

  const togglePaused = () => {
    const svg = svgRef.current;
    const next = !paused;
    setPaused(next);
    try {
      if (svg) {
        if (next) svg.pauseAnimations();
        else svg.unpauseAnimations();
      }
    } catch {
      /* SMIL not available — CSS animation still pauses via class */
    }
  };

  const dim = (s: Exclude<StageKey, "all">) => (sel === "all" || sel === s ? 1 : 0.16);
  const link = (a: Exclude<StageKey, "all">, b: Exclude<StageKey, "all">) =>
    sel === "all" || sel === a || sel === b ? 1 : 0.12;

  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
      <style>{`
        @keyframes arch-dash { to { stroke-dashoffset: -28; } }
        .arch-flow { stroke-dasharray: 7 7; animation: arch-dash 0.9s linear infinite; }
        .arch-paused .arch-flow { animation-play-state: paused; }
        .arch-node { transition: filter 0.15s ease; }
        .arch-node:hover { filter: brightness(0.96) saturate(1.1); }
        .arch-node.is-active { filter: drop-shadow(0 4px 10px rgba(15,23,42,0.20)); }
        .arch-info { cursor: pointer; outline: none; }
        .arch-info-ring { fill: #ffffff; stroke: #4f46e5; stroke-width: 1.6; transform-box: fill-box; transform-origin: center; transition: transform 0.15s ease; }
        .arch-info-glyph { fill: #4f46e5; }
        .arch-info:hover .arch-info-ring, .arch-info:focus .arch-info-ring, .arch-info:focus-visible .arch-info-ring { fill: #4f46e5; transform: scale(1.25); }
        .arch-info:hover .arch-info-glyph, .arch-info:focus .arch-info-glyph, .arch-info:focus-visible .arch-info-glyph { fill: #ffffff; }
        .arch-info.is-active .arch-info-ring { fill: #0f172a; stroke: #0f172a; }
        .arch-info.is-active .arch-info-glyph { fill: #ffffff; }
        @media (prefers-reduced-motion: reduce) { .arch-flow { animation: none; } }
      `}</style>

      {/* Header row: title pill + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-white">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "animate-pulse bg-emerald-400"}`} />
          Data flow · import → feed → render
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSel(s.key)}
              aria-pressed={sel === s.key}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                sel === s.key
                  ? "bg-slate-950 text-white ring-slate-950"
                  : "bg-slate-50 text-slate-600 ring-slate-900/10 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={togglePaused}
            aria-pressed={paused}
            className="ml-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 transition hover:bg-indigo-100"
          >
            {paused ? "▶ Play flow" : "⏸ Pause flow"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-600 bg-emerald-100" /> source / output
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-blue-600 bg-blue-100" /> API endpoint
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-600 bg-amber-100" /> transform / render
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-violet-600 bg-violet-100" /> R2 storage
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t-[2.5px] border-emerald-600" /> product data flow
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t-[2.5px] border-indigo-600" /> snapshot persist
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t-2 border-dashed border-amber-600" /> authenticated / bypass path
        </span>
        <span className="ml-auto hidden font-mono text-[11px] text-slate-400 sm:block">
          style inspired by bytebytego.com
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox="0 0 960 2336"
          role="img"
          aria-label="Catalog Forge data-flow diagram"
          aria-describedby="arch-diagram-desc"
          className={`mx-auto h-auto w-full min-w-[720px] max-w-[880px] ${paused ? "arch-paused" : ""}`}
        >
          {/* NOTE: no <title> anywhere in this SVG on purpose — browsers surface
              ancestor <title>s as delayed native tooltips over the custom InfoTip
              card. aria-label + <desc> keep the same info for assistive tech. */}
          <desc id="arch-diagram-desc">
            Top to bottom: store catalogs, feed URLs and CSVs enter through import APIs, are
            normalized to FeedRow rows and validated, persisted as a versioned project snapshot in
            R2, edited in the template editor, frozen by publishing, then served to the Meta crawler
            as CSV feed rows pointing at versioned render PNGs cached in R2.
          </desc>

          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7.5} markerHeight={7.5} orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#334155" />
            </marker>
            <marker id="arch-arrow-e" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7.5} markerHeight={7.5} orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#059669" />
            </marker>
            <marker id="arch-arrow-i" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7.5} markerHeight={7.5} orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#4f46e5" />
            </marker>
            <marker id="arch-arrow-a" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7.5} markerHeight={7.5} orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#d97706" />
            </marker>
          </defs>

          {/* ══════════ BAND 1 · IMPORT ══════════ */}
          <Band y={72} h={356} tint="#f8fafc" opacity={dim("import")}>
            <g transform="translate(40,55)">
              <StagePill x={0} label="1 · IMPORT" />
            </g>
            <Node x={40} y={120} w={208} h={84} title="Shopify" lines={["/products.json · ≤5000"]} color="green" tip="Step 1 Import: tries Shopify first, falls back to WooCommerce" infoId="shopify" dotApi={dotApi} />
            <Node x={264} y={120} w={208} h={84} title="WooCommerce" lines={["Store API · 5×100"]} color="green" tip="Step 1 Import: WooCommerce Store API fallback" infoId="woo" dotApi={dotApi} />
            <Node x={488} y={120} w={208} h={84} title="Feed URL" lines={["CSV / XML · SSRF guard"]} color="yellow" tip="Step 1 Import: remote feed fetched with SSRF guards, 8 MB / 15 s limits" infoId="feedurl" dotApi={dotApi} />
            <Node x={712} y={120} w={208} h={84} title="CSV upload" lines={["parsed in browser"]} color="slate" tip="Step 1 Import: CSVs parsed client-side" infoId="csv" dotApi={dotApi} />
            <Node x={40} y={268} w={432} h={84} title="GET /api/preview" lines={["Shopify → Woo fallback · login"]} color="blue" titleSize={12.5} tip="Login-only live store import with validation, first 50 rows" infoId="preview" dotApi={dotApi} />
            <Node x={488} y={268} w={432} h={84} title="GET /api/feed-import" lines={["200-row preview · login"]} color="blue" titleSize={12.5} tip="Login-only remote CSV/XML import with validation" infoId="feedimport" dotApi={dotApi} />
            {/* sources drop into their API */}
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M144 204 V266" markerEnd="url(#arch-arrow)" />
              <path d="M368 204 V266" markerEnd="url(#arch-arrow)" />
              <path d="M592 204 V266" markerEnd="url(#arch-arrow)" />
              <path d="M816 204 V266" markerEnd="url(#arch-arrow)" />
            </g>
            {/* APIs merge onto the exit bus */}
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M256 352 V386" markerEnd="url(#arch-arrow)" />
              <path d="M704 352 V386" markerEnd="url(#arch-arrow)" />
              <path d="M256 388 H704" />
              <path d="M480 388 V428" />
            </g>
          </Band>

          {/* ══════════ BAND 2 · SHAPE ══════════ */}
          <Band y={518} h={394} tint="#fffbeb" opacity={dim("shape")}>
            <g transform="translate(40,501)">
              <StagePill x={0} label="2 · SHAPE" />
            </g>
            <Node x={40} y={592} w={424} h={80} title="Auth gate" lines={["ADMIN_PASSWORD → HMAC cookie · 30 d"]} color="yellow" titleSize={12.5} tip="Writes and previews need login; feed and render stay public" infoId="auth" dotApi={dotApi} />
            <Node x={496} y={592} w={424} h={80} title="Rate limits" lines={["preview/feed 30 · import 15 · render 60 · login 10"]} color="slate" titleSize={12.5} tip="Per-IP per-minute limits" infoId="limits" dotApi={dotApi} />
            <Node x={40} y={708} w={272} h={108} title="Normalize" lines={["variants → FeedRow[]", "https · NN.NN CUR"]} color="yellow" tip="Step 2 Normalize: variant expansion, stable ids, price formatting" infoId="normalize" dotApi={dotApi} />
            <Node x={344} y={708} w={272} h={108} title="Validate" lines={["blocked · review · ready", "→ X-Catalog-* headers"]} color="white" tip="Step 3 Validate: ids, titles, images, prices, duplicates, completeness" infoId="validate" dotApi={dotApi} />
            <Node x={648} y={708} w={272} h={108} title="POST /api/projects" lines={["persist snapshot · prj_*"]} color="blue" titleSize={12} tip="Step 4 Snapshot: full project snapshot persisted to R2" infoId="postprojects" dotApi={dotApi} />
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M312 762 H342" markerEnd="url(#arch-arrow)" />
              <path d="M616 762 H646" markerEnd="url(#arch-arrow)" />
            </g>
            <EdgeLabel x={327} y={744}>FeedRow[]</EdgeLabel>
            <EdgeLabel x={631} y={744}>ready</EdgeLabel>
            {/* exit bus */}
            <g fill="none" stroke="#4f46e5" strokeWidth={2.4}>
              <path d="M784 816 V882" markerEnd="url(#arch-arrow-i)" />
              <path d="M784 884 H480 V912" />
            </g>
          </Band>

          {/* ══════════ BAND 3 · WORKSPACE ══════════ */}
          <Band y={1002} h={466} tint="#faf5ff" opacity={dim("workspace")}>
            <g transform="translate(40,985)">
              <StagePill x={0} label="3 · WORKSPACE" />
            </g>
            <Node x={40} y={1076} w={424} h={128} title="CatalogProject · draft" lines={["R2 catalog-projects/ · rev N", "unguessable prj_* id", "revision-guarded writes"]} color="violet" titleSize={12.5} tip="Step 4 Snapshot: draft snapshot in R2, revision-guarded writes" infoId="project" dotApi={dotApi} />
            {/* editor card with layer chips */}
            <g className={`arch-node${dotApi.isActive("editor") ? " is-active" : ""}`}>
              <desc>Step 5 Design: layers resolve bindings per product; stale revisions get a 409</desc>
              <rect x={496} y={1076} width={424} height={128} rx={12} fill="#ffffff" stroke={dotApi.isActive("editor") ? "#0f172a" : "#64748b"} strokeWidth={dotApi.isActive("editor") ? 3 : 1.8} />
              <text x={708} y={1102} textAnchor="middle" fontFamily={SANS} fontSize={12.5} fontWeight={800} fill="#0f172a">Template editor</text>
              <text x={708} y={1120} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="#475569">{"layers · {{bindings}}"}</text>
              <rect x={516} y={1130} width={128} height={28} rx={7} fill="#dbeafe" stroke="#2563eb" strokeWidth={1.2} />
              <rect x={652} y={1130} width={100} height={28} rx={7} fill="#fef3c7" stroke="#d97706" strokeWidth={1.2} />
              <rect x={760} y={1130} width={124} height={28} rx={7} fill="#fce7f3" stroke="#db2777" strokeWidth={1.2} />
              <text x={580} y={1149} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fill="#1e3a8a">product-image</text>
              <text x={702} y={1149} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fill="#92400e">text</text>
              <text x={822} y={1149} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fill="#9d174d">badge</text>
              <text x={708} y={1180} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="#475569">PATCH · 409 on stale rev</text>
              <InfoDot x={898} y={1098} id="editor" label="Template editor" dotApi={dotApi} />
            </g>
            <Node x={40} y={1252} w={424} h={112} title="POST …/publish" lines={["freeze draft → immutable", "prior snapshot kept on failure"]} color="pink" titleSize={12.5} tip="Step 6 Publish: draft deep-cloned into an immutable publication snapshot" infoId="publish" dotApi={dotApi} />
            <Node x={496} y={1252} w={424} h={112} title="CatalogPublication" lines={["active snapshot · frozen", "anonymous reads only"]} color="violet" titleSize={12.5} tip="Immutable publication: anonymous feed serves this, never the live draft" infoId="publication" dotApi={dotApi} />
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M464 1140 H494" markerEnd="url(#arch-arrow)" />
              <path d="M708 1204 V1228 H252 V1250" markerEnd="url(#arch-arrow)" />
              <path d="M464 1308 H494" markerEnd="url(#arch-arrow)" />
            </g>
            <EdgeLabel x={479} y={1122}>open draft</EdgeLabel>
            <EdgeLabel x={480} y={1220}>publish</EdgeLabel>
            <EdgeLabel x={479} y={1290}>freeze</EdgeLabel>
            {/* exit bus */}
            <g fill="none" stroke="#059669" strokeWidth={2.4}>
              <path d="M708 1364 V1398" markerEnd="url(#arch-arrow-e)" />
              <path d="M708 1400 H480 V1468" />
            </g>
          </Band>

          {/* ══════════ BAND 4 · SERVE ══════════ */}
          <Band y={1556} h={764} tint="#f0fdf4" opacity={dim("serve")}>
            <g transform="translate(40,1539)">
              <StagePill x={0} label="4 · SERVE" />
            </g>
            <Node x={120} y={1600} w={720} h={100} title="GET /api/feed" lines={["Meta CSV · frozen publication · anonymous"]} color="blue" titleSize={13} tip="Step 7 Feed: frozen publication served anonymously as Meta CSV" infoId="feed" dotApi={dotApi} />
            <rect x={696} y={1612} width={56} height={20} rx={10} fill="#dcfce7" stroke="#16a34a" strokeWidth={1.2} />
            <text x={724} y={1626} textAnchor="middle" fontFamily={SANS} fontSize={9.5} fontWeight={800} fill="#15803d">PUBLIC</text>
            <Node x={200} y={1752} w={560} h={88} title="versioned image_link" lines={["productRev + templateRev + size"]} color="green" titleSize={12.5} tip="Each feed row points at a content-versioned render URL" infoId="imagelink" dotApi={dotApi} />
            <Node x={200} y={1892} w={560} h={108} title="GET /api/render" lines={["Satori + resvg · Inter", "60/min/IP · miss → R2"]} color="yellow" titleSize={13} tip="Step 8 Render: Satori JSX to PNG, R2-backed immutable cache" infoId="render" dotApi={dotApi} />
            <Node x={200} y={2052} w={560} h={88} title="Renders bucket (R2)" lines={["renders/v2/… · 1y immutable"]} color="violet" titleSize={12.5} tip="Immutable PNG cache keyed by content revisions" infoId="r2" dotApi={dotApi} />
            <Node x={200} y={2192} w={560} h={92} title="Meta crawler" lines={["CSV → PNGs · server-to-server", "no login · capability URLs"]} color="green" titleSize={13} tip="Step 9 Consume: Meta fetches the public CSV, then each PNG; ids act as capability URLs" infoId="meta" dotApi={dotApi} />
            {/* serve spine */}
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M480 1700 V1750" markerEnd="url(#arch-arrow)" />
              <path d="M480 1840 V1890" markerEnd="url(#arch-arrow)" />
            </g>
            <EdgeLabel x={480} y={1732}>image_link per row</EdgeLabel>
            <EdgeLabel x={458} y={1870} anchor="end">GET with revs</EdgeLabel>
            {/* bidirectional render <-> R2 */}
            <path d="M496 2000 V2050" fill="none" stroke="#7c3aed" strokeWidth={2.4} markerStart="url(#arch-arrow)" markerEnd="url(#arch-arrow)" />
            <EdgeLabel x={512} y={2022} anchor="start">write on miss</EdgeLabel>
            <EdgeLabel x={512} y={2040} anchor="start">immutable read</EdgeLabel>
            <g fill="none" stroke="#334155" strokeWidth={2.2}>
              <path d="M480 2140 V2190" markerEnd="url(#arch-arrow)" />
            </g>
            <EdgeLabel x={458} y={2170} anchor="end">PNG bytes</EdgeLabel>
          </Band>

          {/* ── Inter-band connectors (painted after the bands so wires
              stay visible over band backgrounds) ── */}
          <g style={{ opacity: link("import", "shape"), transition: "opacity .2s" }}>
            <path d="M480 428 V688 H176 V706" fill="none" stroke="#059669" strokeWidth={2.6} markerEnd="url(#arch-arrow-e)" />
            <path d="M480 428 V688 H176 V706" fill="none" stroke="#059669" strokeWidth={2.6} className="arch-flow" opacity={0.5} />
            <EdgeLabel x={458} y={476} anchor="end">rows</EdgeLabel>
            <TimeMark y={477} />
          </g>
          <g style={{ opacity: link("shape", "workspace"), transition: "opacity .2s" }}>
            <path d="M480 912 V1044 H252 V1074" fill="none" stroke="#4f46e5" strokeWidth={2.6} markerEnd="url(#arch-arrow-i)" />
            <path d="M480 912 V1044 H252 V1074" fill="none" stroke="#4f46e5" strokeWidth={2.6} className="arch-flow" opacity={0.5} />
            <EdgeLabel x={498} y={958} anchor="start">snapshot rev N</EdgeLabel>
            <TimeMark y={959} />
          </g>
          <g style={{ opacity: link("workspace", "serve"), transition: "opacity .2s" }}>
            <path d="M480 1468 V1598" fill="none" stroke="#059669" strokeWidth={2.6} markerEnd="url(#arch-arrow-e)" />
            <path d="M480 1468 V1598" fill="none" stroke="#059669" strokeWidth={2.6} className="arch-flow" opacity={0.5} />
            <EdgeLabel x={498} y={1514} anchor="start">frozen publication</EdgeLabel>
            <TimeMark y={1515} />
          </g>

          {/* draft preview bypass: workspace → render, down the right corridor */}
          <g style={{ opacity: link("workspace", "serve"), transition: "opacity .2s" }}>
            <desc>Draft preview: ?draft=1 needs login, bypasses the R2 cache, never touches R2</desc>
            <path d="M920 1140 H932 V1946 H762" fill="none" stroke="#fde68a" strokeWidth={7} strokeDasharray="6 6" />
            <path d="M920 1140 H932 V1946 H762" fill="none" stroke="#d97706" strokeWidth={2.2} strokeDasharray="6 6" markerEnd="url(#arch-arrow-a)" />
            <EdgeLabel x={810} y={1516}>?draft=1 · login · skips R2</EdgeLabel>
          </g>

          {/* ── Animated packets on the live path ── */}
          {!paused && (
            <g pointerEvents="none">
              <circle r={6} fill="#059669" stroke="#fff" strokeWidth={2}>
                <animateMotion dur="2.6s" repeatCount="indefinite" path="M480 428 V688 H176 V706" />
              </circle>
              <circle r={6} fill="#4f46e5" stroke="#fff" strokeWidth={2}>
                <animateMotion dur="3.4s" begin="0.9s" repeatCount="indefinite" path="M784 816 V884 H480 V1044 H252 V1074" />
              </circle>
              <circle r={6} fill="#059669" stroke="#fff" strokeWidth={2}>
                <animateMotion dur="4.2s" begin="1.8s" repeatCount="indefinite" path="M480 1468 V2192" />
              </circle>
              <circle r={6} fill="#d97706" stroke="#fff" strokeWidth={2}>
                <animateMotion dur="4.6s" begin="2.6s" repeatCount="indefinite" path="M920 1140 H932 V1946 H762" />
              </circle>
            </g>
          )}

          {/* ── Step badges 1–9 ── */}
          <g style={{ opacity: sel === "all" ? 1 : 0.25, transition: "opacity .2s" }}>
            <StepBadge x={480} y={480} n="1" />
            <StepBadge x={327} y={762} n="2" />
            <StepBadge x={631} y={762} n="3" />
            <StepBadge x={480} y={960} n="4" />
            <StepBadge x={479} y={1140} n="5" />
            <StepBadge x={479} y={1308} n="6" />
            <StepBadge x={480} y={1518} n="7" />
            <StepBadge x={480} y={1866} n="8" />
            <StepBadge x={480} y={2166} n="9" />
          </g>
        </svg>
      </div>

      {/* Floating explainer, anchored next to the hovered / selected dot */}
      {visibleTip && INFO[visibleTip.id] && (
        <InfoTip
          anchorEl={visibleTip.el}
          id={visibleTip.id}
          onClose={() => {
            setHoverTip(null);
            setPinnedTip(null);
          }}
        />
      )}
    </figure>
  );
}
