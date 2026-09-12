"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import { SIZE_PRESETS } from "@/editor/types";
import { DEMO_TEMPLATES } from "@/lib/demoTemplates";
import { heuristicBrandKit, type BrandKit } from "@/lib/brand";
import { parseFeedCsv } from "@/lib/feedImport";
import type { FeedRow } from "@/lib/facebook";
import { useRouter } from "next/navigation";
import { validateCatalog, type CatalogValidationResult } from "@/lib/catalogValidation";

// Concept D — Porcelain Signal
const INK = "#191712";
const MOSS = "#3a5a1e";
const SIGNAL = "#c8f04a";
const PORCELAIN = "#fbfaf6";
const LINE = "#e9e4d6";

type PreviewResponse = {
  domain: string;
  platform?: "shopify" | "woocommerce" | string;
  source?: "shopify" | "woocommerce" | "feed-url" | "csv";
  format?: "csv" | "xml";
  totalFetched: number;
  totalPhysical: number;
  totalVariants: number;
  issues: string[];
  validation?: CatalogValidationResult;
  preview: FeedRow[];
  error?: string;
};

type StructuredError = {
  message: string;
  code?: string;
  platform?: string;
  platformDetail?: string;
  help?: string;
  detail?: string;
};

type SourceTab = "store" | "feed" | "csv";

type Placement = "carousel" | "feed" | "portrait" | "story";

const PLACEMENTS: { id: Placement; label: string }[] = [
  { id: "carousel", label: "Carousel" },
  { id: "feed", label: "Feed" },
  { id: "portrait", label: "Portrait" },
  { id: "story", label: "Story" },
];

const DEFAULT_DOMAIN = "store.gibun.at";

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [feedUrl, setFeedUrl] = useState("");
  const [tab, setTab] = useState<SourceTab>("store");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<StructuredError | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(DEMO_TEMPLATES[0].id);
  const [mode, setMode] = useState<"enriched" | "raw">("enriched");
  const [placement, setPlacement] = useState<Placement>("carousel");
  const [kit, setKit] = useState<BrandKit>(() => heuristicBrandKit(DEFAULT_DOMAIN));
  const [carouselIdx, setCarouselIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const fetchPreview = useCallback(async (d: string) => {
    const target = d.trim() || DEFAULT_DOMAIN;
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    try {
      const [previewRes, brandRes] = await Promise.all([
        fetch(`/api/preview?domain=${encodeURIComponent(target)}`),
        fetch(`/api/brand?domain=${encodeURIComponent(target)}`).catch(() => null),
      ]);
      const json = await previewRes.json() as PreviewResponse & Partial<StructuredError>;
      if (!previewRes.ok) {
        setErrorInfo({
          message: json.error || "Failed to fetch",
          code: json.code,
          platform: json.platform,
          platformDetail: json.platformDetail,
          help: json.help,
          detail: json.detail,
        });
        throw new Error(json.error || "Failed to fetch");
      }
      setData({ ...json, source: json.platform === "woocommerce" ? "woocommerce" : "shopify" });
      setCsvName(null);
      setCsvText(null);
      setCarouselIdx(0);
      setPlacement("carousel");
      if (brandRes?.ok) {
        const bk = (await brandRes.json()) as BrandKit;
        const topVendor = modeCount((json.preview as FeedRow[]).map((p) => p.brand));
        setKit({ ...bk, name: topVendor || bk.name });
      } else {
        const topVendor = modeCount((json.preview as FeedRow[]).map((p) => p.brand));
        setKit(heuristicBrandKit(target, topVendor));
      }
      requestAnimationFrame(() => trackRef.current?.scrollTo({ left: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeed = useCallback(async (u: string) => {
    const target = u.trim();
    if (!target) {
      setError("Paste a feed URL first — e.g. https://example.com/feed.xml");
      setErrorInfo(null);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    try {
      const [feedRes] = await Promise.all([
        fetch(`/api/feed-import?url=${encodeURIComponent(target)}`),
      ]);
      const json = await feedRes.json() as PreviewResponse & { error?: string; help?: string };
      if (!feedRes.ok) {
        setErrorInfo({ message: json.error || "Failed to fetch feed", help: json.help });
        throw new Error(json.error || "Failed to fetch feed");
      }
      setData({ ...json, source: "feed-url" });
      setCsvName(null);
      setCsvText(null);
      setCarouselIdx(0);
      setPlacement("carousel");
      const topVendor = modeCount((json.preview as FeedRow[]).map((p) => p.brand));
      let host = topVendor;
      try {
        host = new URL(json.domain).hostname.replace(/^www\./, "");
      } catch { /* keep vendor */ }
      setKit(heuristicBrandKit(host || target, topVendor));
      requestAnimationFrame(() => trackRef.current?.scrollTo({ left: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCsvFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    try {
      const text = await file.text();
      const rows = parseFeedCsv(text, file.name.replace(/\.[^.]+$/, ""));
      if (rows.length === 0) throw new Error("No products found in this CSV");
      const validation = validateCatalog(rows);
      setData({
        domain: `csv:${file.name}`,
        source: "csv",
        format: "csv",
        totalFetched: rows.length,
        totalPhysical: rows.length,
        totalVariants: rows.length,
        issues: validation.issues.filter((issue) => issue.severity !== "info").map((issue) => `${issue.count} × ${issue.message}`),
        validation,
        preview: rows.slice(0, 50),
      });
      setCsvName(file.name);
      setCsvText(text);
      setCarouselIdx(0);
      setPlacement("carousel");
      const topVendor = modeCount(rows.map((p) => p.brand));
      setKit(heuristicBrandKit(file.name, topVendor));
      requestAnimationFrame(() => trackRef.current?.scrollTo({ left: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setErrorInfo({
        message: e instanceof Error ? e.message : String(e),
        help: "Expected headers like: id,title,description,price,link,image_link,brand,availability. First 200 rows are enough for preview.",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPreview(DEFAULT_DOMAIN);
  }, [fetchPreview]);

  // One card per unique image — variants sharing a packshot collapse.
  const uniques = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedRow[] = [];
    for (const p of data?.preview ?? []) {
      const img = (p.image_link || "").split("?")[0];
      if (!img || seen.has(img)) continue;
      seen.add(img);
      out.push(p);
    }
    return out;
  }, [data]);

  const products = uniques.length > 0 ? uniques : (data?.preview ?? []);
  const single = products[0] ?? null;

  const baseTemplate = useMemo(
    () => DEMO_TEMPLATES.find((t) => t.id === templateId) ?? DEMO_TEMPLATES[0],
    [templateId]
  );

  // D-system recolor: price pill → ink, vendor line → moss.
  const activeTemplate = useMemo(
    () => ({
      ...baseTemplate,
      layers: baseTemplate.layers.map((l) => {
        if (l.type === "badge" && /price/i.test(l.name))
          return { ...l, style: { ...l.style, background: INK, color: "#ffffff" } };
        if (l.type === "text" && /vendor/i.test(l.name))
          return { ...l, style: { ...l.style, color: MOSS } };
        return l;
      }),
    }),
    [baseTemplate]
  );

  const feedVariant = useMemo(() => adaptTemplateToSize(activeTemplate, SIZE_PRESETS[0]), [activeTemplate]);
  const portraitVariant = useMemo(() => adaptTemplateToSize(activeTemplate, SIZE_PRESETS[1]), [activeTemplate]);
  const storyVariant = useMemo(() => adaptTemplateToSize(activeTemplate, SIZE_PRESETS[2]), [activeTemplate]);

  const goToCard = (i: number) => {
    const el = trackRef.current;
    setCarouselIdx(i);
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setCarouselIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const saveProjectAndNavigate = async (path: "/editor" | "/validate") => {
    if (!data) return;
    setProjectSaving(true);
    setProjectError(null);
    try {
      const source = data.source === "feed-url"
        ? { type: "feed-url", value: data.domain || feedUrl }
        : data.source === "csv"
          ? { type: "csv", value: csvName || "catalog.csv", csvText: csvText || "" }
          : { type: "store", value: data.domain || domain };
      const selectedTemplate = placement === "story"
        ? storyVariant
        : placement === "portrait"
          ? portraitVariant
          : feedVariant;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, template: selectedTemplate, placement }),
      });
      const json = await res.json() as { error?: string; id?: string };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Could not save catalog project");
      if (!json.id) throw new Error("Catalog project save did not return an id");
      router.push(`${path}?projectId=${encodeURIComponent(json.id)}`);
    } catch (e) {
      setProjectError(e instanceof Error ? e.message : String(e));
    } finally {
      setProjectSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: PORCELAIN, color: INK }}>
      <header className="shrink-0 border-b bg-white/90 backdrop-blur" style={{ borderColor: LINE }}>
        <div className="max-w-[1300px] mx-auto px-8 py-3 flex items-center gap-3">
          <h1 className="text-[15px] font-bold tracking-tight">Catalog Forge</h1>
          <span className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: MOSS }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: MOSS }} /> LIVE
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => saveProjectAndNavigate("/validate")} disabled={!data || projectSaving} className="text-xs px-3 py-1.5 border rounded-full font-medium hover:bg-zinc-50 disabled:opacity-40" style={{ borderColor: LINE }}>Validate</button>
            <button onClick={() => saveProjectAndNavigate("/editor")} disabled={!data || projectSaving} className="text-xs px-3 py-1.5 text-white rounded-full font-bold disabled:opacity-40" style={{ background: INK }}>{projectSaving ? "Saving…" : "Open Editor →"}</button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-[1300px] mx-auto px-8 grid lg:grid-cols-2 gap-8 items-center">
        {/* LEFT — airy, half width */}
        <div className="max-w-[480px] w-full justify-self-center py-10 space-y-7 lg:pl-14 xl:pl-20">
          <div>
              <div className="font-mono text-[10px] tracking-[0.24em] uppercase" style={{ color: MOSS }}>
                Shopify + Woo → Instagram ad
              </div>
            <h2 className="text-[52px] leading-[1.0] mt-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Your products,<br /><em className="whitespace-nowrap" style={{ color: MOSS }}>dressed for Meta.</em>
            </h2>
            <p className="text-[15px] text-zinc-600 mt-4 leading-relaxed">
              Paste a store URL. We turn the raw catalog into a branded Instagram ad — previewed in the phone.
            </p>
          </div>

          <div className="flex items-center gap-5 text-[13px] font-medium">
            {(["store", "feed", "csv"] as SourceTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? "underline underline-offset-8 decoration-2" : "text-zinc-400 hover:text-zinc-700"}
              >
                {t === "store" ? "Store URL" : t === "feed" ? "Feed URL" : "CSV"}
              </button>
            ))}
            <span className="ml-auto font-mono text-[10.5px] text-zinc-400">Shopify + Woo = instant</span>
          </div>

          {tab === "store" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchPreview(domain);
              }}
              className="flex items-center gap-2 border-b pb-3"
              style={{ borderColor: "#d8d1bd" }}
            >
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="store.gibun.at"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[15px]"
              />
              <button type="submit" disabled={loading} className="text-[22px] leading-none disabled:opacity-30 shrink-0 px-1" aria-label="Load store">
                {loading ? "…" : "→"}
              </button>
            </form>
          )}

          {tab === "store" && (
            <div className="space-y-2 -mt-4">
              <div className="font-mono text-[11px] text-zinc-400">
                Shopify + WooCommerce auto-import works instantly. Wix / Squarespace? Use Feed URL or CSV.
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-zinc-400">try:</span>
                <button onClick={() => { setDomain("store.gibun.at"); fetchPreview("store.gibun.at"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">gibun · shopify</button>
                <button onClick={() => { setDomain("barefootbuttons.com"); fetchPreview("barefootbuttons.com"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">barefootbuttons · woo</button>
                <button onClick={() => { setDomain("jococups.com"); fetchPreview("jococups.com"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">joco · woo</button>
              </div>
            </div>
          )}

          {tab === "feed" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchFeed(feedUrl);
              }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "#d8d1bd" }}>
                <input
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[13px]"
                />
                <button type="submit" disabled={loading} className="text-[22px] leading-none disabled:opacity-30 shrink-0 px-1" aria-label="Load feed">
                  {loading ? "…" : "→"}
                </button>
              </div>
              <div className="font-mono text-[11px] text-zinc-400">
                Google Shopping / Facebook CSV or XML — any platform. We preview the first 200 rows.
              </div>
            </form>
          )}

          {tab === "csv" && (
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 border border-dashed rounded-xl px-4 py-3 cursor-pointer hover:bg-white" style={{ borderColor: "#d8d1bd" }}>
                <span className="text-[13px]">{csvName ? csvName : "Drop a product CSV here or click to browse"}</span>
                <span className="font-mono text-[11px] text-zinc-400 shrink-0">{loading ? "…" : "browse"}</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="font-mono text-[11px] text-zinc-400">
                Headers like: id,title,description,price,link,image_link,brand,availability
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 space-y-1.5">
              <div className="text-[13px] font-medium text-red-800">{error}</div>
              {errorInfo?.platform && errorInfo.platform !== "unknown" && (
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-red-600/80">
                  detected: {errorInfo.platform}{errorInfo.platformDetail ? ` — ${errorInfo.platformDetail}` : ""}
                </div>
              )}
              {errorInfo?.help && <div className="text-[12.5px] leading-relaxed text-red-900/80">{errorInfo.help}</div>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                <button onClick={() => fetchPreview(DEFAULT_DOMAIN)} className="text-[12px] font-medium underline underline-offset-4">Try the Gibun demo →</button>
                <button onClick={() => setTab("feed")} className="font-mono text-[11px] text-red-700/80 underline underline-offset-4">use feed URL</button>
                <button onClick={() => setTab("csv")} className="font-mono text-[11px] text-red-700/80 underline underline-offset-4">upload CSV</button>
                {tab === "store" && errorInfo?.code === "UNSUPPORTED_PLATFORM" && (
                  <button onClick={() => fetchPreview(domain)} className="font-mono text-[11px] text-red-700/80 underline underline-offset-4">retry anyway</button>
                )}
              </div>
            </div>
          )}

          {projectError && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[13px] font-medium text-red-800">
              {projectError}
            </div>
          )}

          {data && single && (
            <div className="space-y-5 pt-1">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-400">
                {kit.name} — {data.totalPhysical} products — {uniques.length} visuals
                {data.source === "woocommerce" ? " — via woo" : ""}
                {data.source && data.source !== "shopify" && data.source !== "woocommerce" ? ` — via ${data.source === "csv" ? (csvName ?? "CSV") : `feed ${data.format ?? ""}`}` : ""}
              </div>
              {data.validation && (
                <div className={`w-fit rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${data.validation.status === "blocked" ? "bg-red-100 text-red-800" : data.validation.status === "needs-review" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                  Catalog {data.validation.status === "blocked" ? `blocked · ${data.validation.errorCount} findings` : data.validation.status === "needs-review" ? "review needed" : "ready"}
                </div>
              )}
              <div className="flex items-baseline gap-5 text-[14px] font-medium">
                {DEMO_TEMPLATES.map((t) => {
                  const short = t.name.replace("Clean ", "").replace("Premium ", "");
                  const isActive = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={isActive ? "underline underline-offset-8 decoration-2" : "text-zinc-400 hover:text-zinc-700"}
                    >
                      {short}
                    </button>
                  );
                })}
                {PLACEMENTS.map((p) => {
                  const isActive = placement === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlacement(p.id)}
                      className={isActive ? "underline underline-offset-8 decoration-2" : "text-zinc-400 hover:text-zinc-700"}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-6 pt-1">
                <button onClick={() => saveProjectAndNavigate("/editor")} disabled={projectSaving} className="text-[14px] font-medium underline underline-offset-8 decoration-1 disabled:opacity-40">{projectSaving ? "Saving project…" : "Customize →"}</button>
                <button onClick={() => setMode(mode === "raw" ? "enriched" : "raw")} className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700 underline underline-offset-4">
                  {mode === "raw" ? "show enriched" : "show raw"}
                </button>
                <button onClick={() => saveProjectAndNavigate("/validate")} disabled={projectSaving} className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700 underline underline-offset-4 disabled:opacity-40">feed health →</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — phone on a whisper of background */}
        <div className="min-h-0 h-full flex items-center justify-center py-6">
          {!data || !single ? (
            <div className="text-sm text-zinc-400">{loading ? "Loading catalog…" : " "}</div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* barely-there warmth so the phone grounds without a panel */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{ width: 460, height: 460, background: "radial-gradient(circle, rgba(58,90,30,0.07), transparent 65%)" }}
              />
              <div className="relative z-10">
                <PhoneCutout>
                  {placement === "story" ? (
                    <StoryScreen product={single} brand={kit.name} logoUrl={kit.logoUrl} mode={mode} template={storyVariant} />
                  ) : (
                    <FeedScreen
                      products={placement === "carousel" ? products : [single]}
                      carousel={placement === "carousel"}
                      brand={kit.name}
                      logoUrl={kit.logoUrl}
                      mode={mode}
                      template={placement === "portrait" ? portraitVariant : feedVariant}
                      trackRef={placement === "carousel" ? trackRef : undefined}
                      onTrackScroll={placement === "carousel" ? onTrackScroll : undefined}
                      carouselIdx={carouselIdx}
                      onDot={goToCard}
                    />
                  )}
                </PhoneCutout>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function modeCount(values: (string | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) {
    best = k;
    bestN = n;
  }
  return best;
}

/* ————————— Phone cutout ————————— */

/* ————————— Phone cutout ————————— */
/* Lab variation 02: floating ¾ tilt. True 3D slab (front / back / core /
   4 edge walls) with 01's photoreal titanium recipe on the front face.
   Screen content (incl. the carousel track) renders inside untouched. */

const PHONE_W = 288;
const PHONE_H = 600;
const PHONE_T = 18;
const PHONE_HALF = PHONE_T / 2;

function PhoneCutout({ children }: { children: React.ReactNode }) {
  // Near-level rest tilt: bottom edge stays shut (its face + interior reveal
  // grow fast with downward angle); hover still adds ±5° of life.
  const [tilt, setTilt] = useState({ x: 1, y: -14 });
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="relative shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
      style={{ perspective: 2000, width: 340, height: 656 }}
      onMouseMove={(e) => {
        if (dragging) return; // freeze while swiping the carousel — otherwise
        // the phone chases the cursor mid-drag and the image seems to jump
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ x: 1 - py * 10, y: -14 + px * 14 });
      }}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onMouseLeave={() => { setDragging(false); setTilt({ x: 1, y: -14 }); }}
    >
      {/* two-layer floor shadow, key light top-left: wide faint ambient ramp
          + tighter core that breathes in sync with the 7s levitation bob.
          Opacity-only animation so it never fights the tilt transform. */}
      <div className="absolute bottom-0 left-1/2 w-[240px] h-[26px] rounded-[100%] pointer-events-none"
        style={{ background: "rgba(25,23,18,0.16)", filter: "blur(26px)", transform: `translateX(calc(-50% + 16px + ${tilt.y * 1.6}px))` }} />
      <div className="absolute bottom-2 left-1/2 w-[160px] h-[11px] rounded-[100%] pointer-events-none"
        style={{ background: "#191712", opacity: 0.3, filter: "blur(9px)", transform: `translateX(calc(-50% + 10px + ${tilt.y * 1.2}px))`, animation: "phone-shadow-breathe 7s ease-in-out infinite" }} />

      {/* gentle levitation — half-distance bob so the phone never reads as jumping */}
      <div style={{ animation: "phone-floaty 7s ease-in-out infinite" }}>
        {/* TILT only — driven by hover state */}
        <div className="preserve-3d relative" style={{
          width: PHONE_W, height: PHONE_H,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(1deg)`,
          transition: "transform 280ms ease-out",
        }}>
          {/* back plate (dark titanium + camera plateau), inset so it never
              peeks past the front silhouette in corners */}
          <div className="absolute rounded-[52px] brushed" style={{
            inset: 2,
            transform: `translateZ(${-PHONE_HALF}px)`,
            background: "linear-gradient(150deg,#3a3733,#171614 60%,#2b2925)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25)",
          }}>
            <div className="absolute left-5 top-5 w-[104px] h-[104px] rounded-[28px]" style={{
              background: "linear-gradient(150deg,#4a463f,#1c1a17)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 10px rgba(0,0,0,0.4)",
            }}>
              <div className="absolute left-3 top-3 w-[42px] h-[42px] rounded-full bg-black" style={{ boxShadow: "inset 0 0 0 3px #2c2a26, inset 0 0 0 5px #0a0a0a" }}>
                <div className="absolute top-[8px] left-[8px] w-[10px] h-[10px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #2a4a7f, #000 70%)" }} />
              </div>
              <div className="absolute right-3 bottom-3 w-[42px] h-[42px] rounded-full bg-black" style={{ boxShadow: "inset 0 0 0 3px #2c2a26, inset 0 0 0 5px #0a0a0a" }}>
                <div className="absolute top-[8px] left-[8px] w-[10px] h-[10px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #2a4a7f, #000 70%)" }} />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-white/25 text-[40px]">◍</div>
          </div>

          {/* solid core — fills the slab so corner seams never see through.
              Height 96% (top-anchored): a full-height core's dark bottom/right
              edge projects past the front silhouette under perspective and reads
              as extra chin — pulled up it hides behind the opaque front face.
              Walls stay as-is: they land on the full-size front/back faces, and
              the full-height back plate still backs every corner gap, so no
              see-through lines can open at the bottom or right. */}
          <div className="absolute rounded-[54px] pointer-events-none" style={{
            inset: 0,
            height: "96%",
            transform: "translateZ(0)",
            background: "linear-gradient(150deg,#2e2c28,#131211 55%,#232120)",
          }} />

          {/* edge walls (straight sections only — clear of the corner radius,
              ends faded via mask so highlights dissolve into the curves.
              Side walls flush with the body (nothing past the silhouette at
              rest — hover rotation still reveals the edge faces dynamically) */}
          <div className="absolute" style={{
            top: 58, bottom: 58, right: "0px", width: PHONE_T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, #6b665c 18%, #2b2925 60%, #0f0e0c 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
          </div>
          <div className="absolute" style={{
            top: 58, bottom: 58, left: "0px", width: PHONE_T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, #0f0e0c 0%, #2b2925 55%, #57534a 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
          </div>
          <div className="absolute" style={{
            left: 58, right: 58, top: 0, height: PHONE_T, marginTop: -PHONE_HALF,
            transform: "rotateX(90deg)",
            background: "linear-gradient(180deg, #8d877b 0%, #2b2925 70%, #0f0e0c 100%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
          }}>
            <div className="absolute top-0 bottom-0" style={{ left: 26, width: 3, background: "#b9b2a2" }} />
            <div className="absolute top-0 bottom-0" style={{ right: 26, width: 3, background: "#b9b2a2" }} />
          </div>
          {/* bottom wall — top 96% (not 100%): at 100% the wall's dark band
              hangs ~9px past the body and reads as chin; tucked up it hides
              behind the opaque front face */}
          <div className="absolute" style={{
            left: 58, right: 58, top: "96%", height: PHONE_T, marginTop: -PHONE_HALF,
            transform: "rotateX(90deg)",
            background: "linear-gradient(180deg, #0f0e0c 0%, #2b2925 60%, #57534a 100%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
          }}>
            <div className="absolute top-0 bottom-0" style={{ left: 26, width: 3, background: "#8f887a" }} />
            <div className="absolute top-0 bottom-0" style={{ right: 26, width: 3, background: "#8f887a" }} />
          </div>

          {/* front face — photoreal titanium: unibody + chamfer + gasket */}
          <div className="absolute inset-0 rounded-[54px] brushed" style={{
            transform: `translateZ(${PHONE_HALF}px)`,
            background: "linear-gradient(148deg, #9a9488 0%, #4c4841 12%, #211f1c 28%, #3d3a35 48%, #131211 66%, #5c5850 84%, #2c2a26 100%)",
            padding: 2.5,
            boxShadow: "14px 26px 44px -10px rgba(25,23,18,0.32)",
          }}>
            {/* antenna bands */}
            <div className="absolute left-[52px] top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute right-[52px] top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute left-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            <div className="absolute right-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            {/* milled side buttons — ride the front plane so they tilt along */}
            <div className="absolute -left-[2.5px] top-[104px] w-[3.5px] h-[26px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[140px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[194px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -right-[2.5px] top-[150px] w-[3.5px] h-[64px] rounded-r-md z-10" style={{ background: "linear-gradient(270deg,#6e695f,#35322d)" }} />
            {/* chamfer — polished edge that catches light */}
            <div className="w-full h-full rounded-[51.5px]" style={{
              background: "linear-gradient(148deg, rgba(255,255,255,0.75), rgba(255,255,255,0.08) 18%, rgba(0,0,0,0.35) 55%, rgba(255,255,255,0.28) 85%, rgba(255,255,255,0.55))",
              padding: 1.5,
            }}>
              <div className="w-full h-full rounded-[50px] bg-[#0a0908]" style={{ padding: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9)" }}>
                <div className="relative w-full h-full rounded-[43px] overflow-hidden bg-white flex flex-col min-h-0"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5)" }}>
                  {children}
                  {/* angle-reactive showroom sheen + curved-glass vignette */}
                  <div className="absolute inset-0 pointer-events-none z-20" style={{
                    background: `linear-gradient(${(105 + tilt.y * 1.5)}deg, transparent 30%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.08) 50%, transparent 60%)`,
                  }} />
                  <div className="absolute inset-0 pointer-events-none z-20" style={{
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 0 30px rgba(0,0,0,0.16)",
                    borderRadius: "inherit",
                  }} />
                  {/* dynamic island with lens glint */}
                  <div className="absolute top-[11px] left-1/2 -translate-x-1/2 w-[88px] h-[25px] bg-black rounded-full z-30 flex items-center justify-end pr-3 gap-1.5"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.5)" }}>
                    <span className="w-[9px] h-[9px] rounded-full relative overflow-hidden" style={{ background: "radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0a1628 45%, #000 70%)" }}>
                      <span className="absolute top-[1.5px] left-[1.5px] w-[2.5px] h-[2.5px] rounded-full bg-blue-400/80 blur-[0.5px]" />
                    </span>
                    <span className="w-[5px] h-[5px] rounded-full bg-[#1a1d22]" style={{ boxShadow: "inset 0 0 1px rgba(120,180,255,0.5)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ light }: { light?: boolean }) {
  return (
    <div className={`flex items-center justify-between pl-7 pr-6 pt-3.5 pb-1 text-[11px] font-semibold shrink-0 ${light ? "text-white" : "text-black"}`}>
      <span className="w-10">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5" /><rect x="4" y="5" width="3" height="6" rx="0.5" /><rect x="8" y="2.5" width="3" height="8.5" rx="0.5" /><rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.4" /></svg>
        <svg width="22" height="11" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

function PostHeader({ brand, logoUrl }: { brand: string; logoUrl: string | null }) {
  const handle = brand.toLowerCase().replace(/[^a-z0-9]+/g, "") || "shop";
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 shrink-0">
      <span className="rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)" }}>
        <span className="block w-[30px] h-[30px] rounded-full bg-white p-[2px]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full rounded-full object-contain" />
          ) : (
            <span className="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: MOSS }}>
              {brand.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[12px] font-semibold truncate">{handle}</div>
        <div className="text-[11px] text-zinc-500">Sponsored</div>
      </div>
      <span className="ml-auto text-[15px] tracking-widest text-zinc-800 px-1">•••</span>
    </div>
  );
}

function FeedScreen({
  products, carousel, brand, logoUrl, mode, template, trackRef, onTrackScroll, carouselIdx, onDot,
}: {
  products: FeedRow[];
  carousel: boolean;
  brand: string;
  logoUrl: string | null;
  mode: "enriched" | "raw";
  template: Parameters<typeof TemplateRenderer>[0]["template"];
  trackRef?: React.RefObject<HTMLDivElement | null>;
  onTrackScroll?: () => void;
  carouselIdx: number;
  onDot: (i: number) => void;
}) {
  const cards = (carousel ? products.slice(0, 12) : products.slice(0, 1));
  const active = cards[Math.min(carouselIdx, cards.length - 1)] ?? cards[0];
  const handle = brand.toLowerCase().replace(/[^a-z0-9]+/g, "") || "shop";
  const scale = 0.252; // 280px screen width / 1080 template
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <StatusBar />
      <PostHeader brand={brand} logoUrl={logoUrl} />
      {carousel && trackRef ? (
        <div ref={trackRef} onScroll={onTrackScroll} className="flex overflow-x-auto snap-x snap-mandatory shrink-0" style={{ scrollbarWidth: "none" }}>
          {cards.map((p) => (
            <div key={p.id} className="snap-center shrink-0 w-full">
              <div className="w-full aspect-square overflow-hidden">
                {mode === "raw" ? <RawFill product={p} /> : <TemplateRenderer template={template} product={p} scale={scale} />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full aspect-square overflow-hidden shrink-0">
          {active && (mode === "raw" ? <RawFill product={active} /> : <TemplateRenderer template={template} product={active} scale={scale} />)}
        </div>
      )}
      <div className="px-2.5 pt-2 flex items-center shrink-0">
        <span className="flex items-center gap-3 text-[20px] leading-none">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" strokeWidth="1.5"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.3 5 5.7 5c2 0 3.4 1.1 4.3 2.6h4C15 6.1 16.4 5 18.4 5c3.4 0 5.3 3.6 3.7 6.7C19.5 16.4 12 21 12 21z" transform="scale(0.92) translate(1,1)" /></svg>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" strokeLinejoin="round" /></svg>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 2 11 13" strokeLinecap="round" /><path d="M22 2 15 22l-4-9-9-4 20-7z" strokeLinejoin="round" /></svg>
        </span>
        {cards.length > 1 && (
          <button className="mx-auto flex gap-1 px-2" aria-label="carousel dots">
            {cards.slice(0, 6).map((p, i) => (
              <span key={p.id} onClick={() => onDot(i)} className="h-[6px] rounded-full cursor-pointer" style={{ width: i === Math.min(carouselIdx, 5) ? 16 : 6, background: i === Math.min(carouselIdx, 5) ? "#3897f0" : "#c7c7c7" }} />
            ))}
          </button>
        )}
        <span className="ml-auto">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <div className="px-2.5 pt-1 text-[12px] font-semibold shrink-0">2,314 likes</div>
      {/* caption locked to exactly 2 lines: long/short descriptions render the
          same text block, so the shop card below never shifts */}
      <div className="px-2.5 pt-0.5 text-[12px] leading-snug flex-1 min-h-0 overflow-hidden">
        {/* inline clamp (not utilities): guarantees -webkit-box isn't overridden
            and min-height applies — exactly 2 lines for every product */}
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.75em" }}>
          <span className="font-semibold">{handle}</span>{" "}
          {active && <span>{active.title} ✨ Tap to shop — <span className="text-zinc-500">#{handle} #newin</span></span>}
        </span>
      </div>
      <div className="mx-2.5 mb-2.5 mt-1 rounded-xl border overflow-hidden shrink-0" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-2 px-2.5 h-[50px]" style={{ background: PORCELAIN }}>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[11.5px] font-semibold truncate">{active?.title}</div>
            <div className="font-mono text-[10px] text-zinc-500">{active?.price}</div>
          </div>
          <span className="text-[11.5px] font-bold text-white rounded-full px-3 py-1.5 shrink-0" style={{ background: INK }}>Shop Now</span>
        </div>
      </div>
      {/* IG tab bar */}
      <div className="flex items-center justify-around py-2 border-t bg-white shrink-0 text-[19px]">
        <span>⌂</span><span className="opacity-30">⚲</span><span className="opacity-30">▣</span><span className="opacity-30">🎬</span>
        <span className="w-[20px] h-[20px] rounded-full bg-zinc-200 overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
        </span>
      </div>
    </div>
  );
}

function StoryScreen({
  product, brand, logoUrl, mode, template,
}: {
  product: FeedRow;
  brand: string;
  logoUrl: string | null;
  mode: "enriched" | "raw";
  template: Parameters<typeof TemplateRenderer>[0]["template"];
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black relative">
      <StatusBar light />
      <div className="px-2.5 pt-1 flex gap-1">
        <div className="h-[2.5px] flex-1 bg-white rounded-full" />
        <div className="h-[2.5px] flex-1 bg-white/30 rounded-full" />
        <div className="h-[2.5px] flex-1 bg-white/30 rounded-full" />
      </div>
      <div className="px-2.5 py-2 flex items-center gap-2">
        <span className="rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f9ce34,#ee2a7b)" }}>
          <span className="block w-6 h-6 rounded-full bg-black p-[2px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="w-full h-full rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: MOSS }}>
                {brand.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        </span>
        <span className="text-white text-[11.5px] font-semibold">{brand.toLowerCase().replace(/[^a-z0-9]+/g, "")}</span>
        <span className="ml-auto text-white text-[14px]">•••</span>
        <span className="text-white text-[14px]">✕</span>
      </div>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {mode === "raw" ? (
          <div className="absolute inset-0"><RawFill product={product} /></div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <TemplateRenderer template={template} product={product} scale={0.252} />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-center text-[11.5px] font-bold text-black rounded-full py-2" style={{ background: SIGNAL }}>Shop Now → {product.price}</div>
      </div>
    </div>
  );
}

function RawFill({ product }: { product: FeedRow }) {
  return (
    <div className="aspect-square w-full h-full bg-zinc-100 flex flex-col items-center justify-center p-6 text-center">
      {product.image_link ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_link} alt={product.title} className="max-h-[68%] max-w-full object-contain bg-white rounded" />
      ) : (
        <div className="text-xs text-zinc-400">No image</div>
      )}
      <div className="text-xs mt-3 truncate max-w-full">{product.title}</div>
      <div className="text-[11px] text-zinc-500">{product.price}</div>
    </div>
  );
}
