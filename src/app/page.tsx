"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import { SIZE_PRESETS, type Template } from "@/editor/types";
import { DEMO_TEMPLATES } from "@/lib/demoTemplates";
import { HOMEPAGE_SLOTS } from "@/lib/homepageTemplates";
import { heuristicBrandKit, type BrandKit } from "@/lib/brand";
import { parseFeedCsv } from "@/lib/feedImport";
import type { FeedRow } from "@/lib/facebook";
import { useRouter } from "next/navigation";
import { validateCatalog, type CatalogValidationResult } from "@/lib/catalogValidation";
import { PhoneHero } from "@/components/PhoneHero";
import { IgTabBar } from "@/components/IgTabBar";
import { sampleImageColor } from "@/lib/imageColor";

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
  const [templateId, setTemplateId] = useState<string>(HOMEPAGE_SLOTS[0].id);
  // Homepage showcase designs (Admin-editable). DEMO_TEMPLATES are the
  // offline fallback — identical pixels until the fetch resolves.
  const [showcase, setShowcase] = useState<Template[] | null>(null);
  const TEMPLATES = showcase ?? DEMO_TEMPLATES;
  const [mode, setMode] = useState<"enriched" | "raw">("enriched");
  const [placement, setPlacement] = useState<Placement>("carousel");
  const [kit, setKit] = useState<BrandKit>(() => heuristicBrandKit(DEFAULT_DOMAIN));
  const [carouselIdx, setCarouselIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // Before/after wipe on the hero creative: one parked position shared by all
  // slides (stable while swiping), handle-only drag so the carousel swipe wins.
  const [compareOn, setCompareOn] = useState(true);
  const [comparePos, setComparePos] = useState(62);

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

  useEffect(() => {
    fetch("/api/homepage-templates")
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { slots?: { template: Template }[] };
        if (json.slots?.length) setShowcase(json.slots.map((s) => s.template));
      })
      .catch(() => {});
  }, []);

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

  /* Living backdrop glow: average hue of the visible product photo, cached
     per image URL. Sampling is a 24px canvas read on load (microseconds);
     the creative already fetched the bytes, so no extra download. Tainted
     canvases (host without CORS) yield null → we keep the previous glow. */
  const [glow, setGlow] = useState<string | null>(null);
  const glowCache = useRef(new Map<string, string>());
  const glowSrc =
    (placement === "carousel"
      ? products[Math.min(carouselIdx, Math.max(products.length - 1, 0))]
      : single)?.image_link || "";
  useEffect(() => {
    if (!glowSrc) return;
    const hit = glowCache.current.get(glowSrc);
    if (hit) setGlow((g) => (g === hit ? g : hit));
  }, [glowSrc]);

  const baseTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId, TEMPLATES]
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
    <div className="min-h-screen flex flex-col" style={{ background: PORCELAIN, color: INK }}>
      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-40" style={{ borderColor: LINE }}>
        <div className="max-w-[1300px] mx-auto px-8 py-3 flex items-center gap-3">
          <h1 className="text-[15px] font-bold tracking-tight">Catalog Forge</h1>
          <span className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: MOSS }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: MOSS }} /> LIVE
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => saveProjectAndNavigate("/validate")} disabled={!data || projectSaving} className="text-xs px-3 py-1.5 border rounded-full font-medium hover:bg-zinc-50 disabled:opacity-40" style={{ borderColor: LINE }}>Validate</button>
            <button onClick={() => router.push("/admin")} className="text-xs px-3 py-1.5 border rounded-full font-medium hover:bg-zinc-50" style={{ borderColor: LINE }}>Admin</button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1300px] mx-auto px-8 grid lg:grid-cols-2 gap-8 items-start">
        {/* LEFT — card rail, scrolls with the page */}
        <div className="max-w-[520px] w-full justify-self-center py-10 space-y-4 lg:pl-10 xl:pl-16">
          <div>
              <div className="font-mono text-[10px] tracking-[0.24em] uppercase" style={{ color: MOSS }}>
                Shopify + Woo → Instagram ad
              </div>
            <h2 className="text-[52px] leading-[1.0] mt-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Your products,<br /><em className="whitespace-nowrap" style={{ color: MOSS }}>dressed for social.</em>
            </h2>
            <p className="text-[15px] text-zinc-600 mt-4 leading-relaxed">
              Paste your store, feed, or CSV. We turn your catalog into beautiful, on-brand Instagram ads — in seconds.
            </p>
          </div>

          {/* source controls — directly on the page, no card */}
          <div className="space-y-3">
            <div className="flex rounded-full p-1 gap-1" style={{ background: "#f1efe9" }}>
              {([
                { id: "store", label: "Store URL", icon: <LinkIcon /> },
                { id: "feed", label: "Feed URL", icon: <DocIcon /> },
                { id: "csv", label: "CSV Upload", icon: <UploadIcon /> },
              ] as { id: SourceTab; label: string; icon: React.ReactNode }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium transition ${tab === t.id ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "store" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchPreview(domain);
                }}
                className="flex gap-2"
              >
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="store.gibun.at"
                  spellCheck={false}
                  className="flex-1 min-w-0 border rounded-xl px-3.5 py-2.5 outline-none font-mono text-[13px] bg-white focus:border-zinc-400"
                  style={{ borderColor: LINE }}
                />
                <button type="submit" disabled={loading} className="px-4 rounded-xl text-white text-[13px] font-bold shrink-0 disabled:opacity-50" style={{ background: MOSS }}>
                  {loading ? "…" : "Generate previews →"}
                </button>
              </form>
            )}

            {tab === "feed" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchFeed(feedUrl);
                }}
                className="flex gap-2"
              >
                <input
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  spellCheck={false}
                  className="flex-1 min-w-0 border rounded-xl px-3.5 py-2.5 outline-none font-mono text-[13px] bg-white focus:border-zinc-400"
                  style={{ borderColor: LINE }}
                />
                <button type="submit" disabled={loading} className="px-4 rounded-xl text-white text-[13px] font-bold shrink-0 disabled:opacity-50" style={{ background: MOSS }}>
                  {loading ? "…" : "Generate previews →"}
                </button>
              </form>
            )}

            {tab === "csv" && (
              <label className="flex items-center justify-between gap-3 border border-dashed rounded-xl px-4 py-3 cursor-pointer hover:bg-zinc-50" style={{ borderColor: "#d8d1bd" }}>
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
            )}

            <div className="font-mono text-[11px] text-zinc-400">
              {tab === "store" && "Shopify + WooCommerce auto-import works instantly."}
              {tab === "feed" && "Google Shopping / Facebook CSV or XML — any platform. We preview the first 200 rows."}
              {tab === "csv" && "Headers like: id,title,description,price,link,image_link,brand,availability"}
            </div>

            {tab === "store" && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-zinc-400">try:</span>
                <button onClick={() => { setDomain("store.gibun.at"); fetchPreview("store.gibun.at"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">gibun · shopify</button>
                <button onClick={() => { setDomain("barefootbuttons.com"); fetchPreview("barefootbuttons.com"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">barefootbuttons · woo</button>
                <button onClick={() => { setDomain("jococups.com"); fetchPreview("jococups.com"); }} className="text-zinc-500 underline underline-offset-4 hover:text-zinc-800">joco · woo</button>
              </div>
            )}
          </div>

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

          {/* catalog status card */}
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            {!data || !single ? (
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-zinc-100">
                  <GridIcon dim />
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-bold tracking-tight">{loading ? "Reading catalog…" : "No catalog yet"}</div>
                  <div className="font-mono text-[11px] text-zinc-400">load a store above to inspect it</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#e7f0d8", color: MOSS }}>
                    <CheckIcon />
                  </span>
                  <div className="leading-tight min-w-0">
                    <div className="text-[15px] font-bold tracking-tight">Catalog found</div>
                    <div className="font-mono text-[11px] text-zinc-500 truncate">
                      {kit.name}
                      {data.source === "woocommerce" ? " · via woo" : ""}
                      {data.source && data.source !== "shopify" && data.source !== "woocommerce" ? ` · via ${data.source === "csv" ? (csvName ?? "CSV") : `feed ${data.format ?? ""}`}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => saveProjectAndNavigate("/validate")}
                    disabled={projectSaving}
                    className="ml-auto p-2 rounded-full hover:bg-zinc-100 disabled:opacity-40 shrink-0 text-zinc-500"
                    title="Open feed health"
                    aria-label="Open feed health"
                  >
                    <ChevronIcon />
                  </button>
                </div>
                <div className="flex items-stretch mt-3 pt-3 border-t" style={{ borderColor: "#f1efe9" }}>
                  <div className="flex-1 leading-tight">
                    <div className="text-[19px] font-bold tracking-tight">{data.totalPhysical}</div>
                    <div className="font-mono text-[10px] text-zinc-400">products</div>
                  </div>
                  <div className="w-px mx-4" style={{ background: "#f1efe9" }} />
                  <div className="flex-1 leading-tight">
                    <div className="text-[19px] font-bold tracking-tight">{uniques.length}</div>
                    <div className="font-mono text-[10px] text-zinc-400">visuals</div>
                  </div>
                  <div className="w-px mx-4" style={{ background: "#f1efe9" }} />
                  <div className="flex-[1.4] leading-tight">
                    {data.validation && data.validation.status !== "ready" ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-amber-700">
                          <WarnIcon />
                          {data.validation.errorCount + data.validation.warningCount} issue{(data.validation.errorCount + data.validation.warningCount) === 1 ? "" : "s"}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400 truncate" title={data.issues[0]}>
                          {data.issues[0] ?? "needs review before Meta"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: MOSS }}>
                          <CheckIcon small />
                          No issues
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400">feed healthy</div>
                      </>
                    )}
                  </div>
                </div>
                {projectError && (
                  <div className="pt-2 text-[12px] font-medium text-red-800">{projectError}</div>
                )}
              </>
            )}
          </div>

          {/* preview styles card */}
          {data && single && (
            <div className="rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: LINE }}>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-600">
                  <GridIcon />
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-bold tracking-tight">Preview styles</div>
                  <div className="text-[12px] text-zinc-500">Choose a style to preview your products.</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 pb-1.5">Design</div>
                <div className="flex gap-2.5">
                  {TEMPLATES.map((t) => {
                    const short = t.name.replace("Clean ", "").replace("Premium ", "");
                    const isActive = t.id === templateId;
                    return (
                      <button key={t.id} onClick={() => setTemplateId(t.id)} className="shrink-0">
                        <span
                          className="block w-[68px] h-[68px] rounded-xl overflow-hidden border-2 bg-white"
                          style={{ borderColor: isActive ? MOSS : "#e9e4d6" }}
                        >
                          <TemplateRenderer template={t} product={single} scale={68 / 1080} />
                        </span>
                        <span className={`block pt-1 text-[11px] ${isActive ? "font-bold text-zinc-900" : "text-zinc-500"}`}>{short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 pb-1.5">Placement</div>
                <div className="flex gap-2.5">
                  {PLACEMENTS.map((p) => {
                    const v = p.id === "portrait"
                      ? { t: portraitVariant, w: 54 }
                      : p.id === "story"
                        ? { t: storyVariant, w: 38 }
                        : { t: feedVariant, w: 68 };
                    const isActive = placement === p.id;
                    return (
                      <button key={p.id} onClick={() => setPlacement(p.id)} className="shrink-0">
                        <span
                          className="flex items-end justify-center rounded-xl overflow-hidden border-2 bg-white"
                          style={{ width: 68, height: 68, borderColor: isActive ? MOSS : "#e9e4d6" }}
                        >
                          <span className="block overflow-hidden" style={{ width: v.w, height: Math.round(v.w * (v.t.height / v.t.width)) }}>
                            <TemplateRenderer template={v.t} product={single} scale={v.w / 1080} />
                          </span>
                        </span>
                        <span className={`block pt-1 text-[11px] ${isActive ? "font-bold text-zinc-900" : "text-zinc-500"}`}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-5 pt-1 font-mono text-[11px]">
                <button onClick={() => setMode(mode === "raw" ? "enriched" : "raw")} className="text-zinc-400 hover:text-zinc-700 underline underline-offset-4">
                  {mode === "raw" ? "view enriched →" : "view raw data →"}
                </button>
                <button
                  onClick={() => { if (!compareOn) setMode("enriched"); setCompareOn(!compareOn); }}
                  className={`underline underline-offset-4 ${compareOn ? "text-zinc-800 font-semibold" : "text-zinc-400 hover:text-zinc-700"}`}
                  title="Wipe between raw photo and forged creative"
                >
                  ⇔ compare
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — phone stays fixed while the left rail scrolls */}
        <div className="flex items-center justify-center py-10 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:py-0 min-h-[700px]">
          {!data || !single ? (
            <div className="text-sm text-zinc-400">{loading ? "Loading catalog…" : " "}</div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* living warmth: hue sampled from the visible product photo,
                  crossfaded via the registered --hero-glow property */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 520,
                  height: 520,
                  background: "radial-gradient(circle, color-mix(in srgb, var(--hero-glow) 20%, transparent), transparent 65%)",
                  transition: "--hero-glow 700ms ease",
                  "--hero-glow": glow ? `rgb(${glow})` : "#3a5a1e",
                } as React.CSSProperties}
              />
              {/* hidden sampler: same bytes as the creative (browser cache) */}
              {glowSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={glowSrc}
                  src={glowSrc}
                  crossOrigin="anonymous"
                  alt=""
                  aria-hidden
                  className="hidden"
                  onLoad={(e) => {
                    if (glowCache.current.has(glowSrc)) return;
                    const g = sampleImageColor(e.currentTarget);
                    if (g) {
                      glowCache.current.set(glowSrc, g);
                      setGlow((prev) => (prev === g ? prev : g));
                    }
                  }}
                />
              ) : null}
              <div className="relative z-10">
                <PhoneHero fidelity="atelier">
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
                      compare={compareOn ? { pos: comparePos, onPos: setComparePos } : undefined}
                    />
                  )}
                </PhoneHero>
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

/* ————————— left-rail icons ————————— */

function RailIcon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function LinkIcon() {
  return (
    <RailIcon>
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </RailIcon>
  );
}

function DocIcon() {
  return (
    <RailIcon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </RailIcon>
  );
}

function UploadIcon() {
  return (
    <RailIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </RailIcon>
  );
}

function GridIcon({ dim }: { dim?: boolean }) {
  return (
    <span className={dim ? "text-zinc-400" : undefined}>
      <RailIcon size={17}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </RailIcon>
    </span>
  );
}

function CheckIcon({ small }: { small?: boolean }) {
  return (
    <RailIcon size={small ? 15 : 20}>
      <path d="M8 12.5l2.7 2.7L16.5 9" />
    </RailIcon>
  );
}

function WarnIcon() {
  return (
    <RailIcon size={17}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </RailIcon>
  );
}

function ChevronIcon() {
  return (
    <RailIcon size={18}>
      <path d="M9 6l6 6-6 6" />
    </RailIcon>
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

/* ————————— Creative slide with optional raw/forged wipe ————————— */
/* Forged creative as the base; the raw catalog photo reveals left of the
   handle. Drag target is the handle only (touch-none) so the carousel swipe
   keeps working everywhere else. No compare in raw mode (raw-vs-raw). */

function CreativeSlide({
  product, mode, template, scale, compare,
}: {
  product: FeedRow;
  mode: "enriched" | "raw";
  template: Parameters<typeof TemplateRenderer>[0]["template"];
  scale: number;
  compare?: { pos: number; onPos: (n: number) => void };
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const showCompare = mode === "enriched" && compare && product.image_link;
  const move = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || r.width === 0 || !compare) return;
    const raw = ((clientX - r.left) / r.width) * 100;
    if (!Number.isFinite(raw)) return;
    const c = Math.min(100, Math.max(0, raw));
    compare.onPos(c < 5 ? 0 : c > 95 ? 100 : c);
  };
  return (
    <div ref={boxRef} className="w-full aspect-square overflow-hidden shrink-0 relative select-none">
      {mode === "raw" ? <RawFill product={product} /> : <TemplateRenderer template={template} product={product} scale={scale} />}
      {showCompare && compare && (
        <>
          {/* raw reveal: the catalog file full-bleed against the designed cell.
              Opaque WHITE backing — transparent-background packshots
              (white-that-is-actually-alpha) must show white, never the
              forged layers beneath. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - compare.pos}% 0 0)`, background: "#ffffff", zIndex: 10 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_link}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <span
            className="absolute top-2 left-2 text-[9px] font-bold rounded-full px-2 py-0.5 pointer-events-none bg-white/85 text-zinc-700"
            style={{ opacity: compare.pos > 12 ? 1 : 0, transition: "opacity 200ms", zIndex: 20 }}
          >
            RAW
          </span>
          <span
            className="absolute top-2 right-2 text-[9px] font-bold text-white rounded-full px-2 py-0.5 pointer-events-none"
            style={{ background: "rgba(25,23,18,0.85)", opacity: compare.pos < 88 ? 1 : 0, transition: "opacity 200ms", zIndex: 20 }}
          >
            FORGED ✓
          </span>
          {/* handle: a real 44px grab box (a 0-width strip with
              pointer-events-none children is unhittable) + pointer capture
              so fast drags can't escape onto the template layers */}
          <div
            className="absolute top-0 bottom-0 w-[44px] -translate-x-1/2 touch-none select-none"
            style={{ left: `${compare.pos}%`, cursor: "ew-resize", zIndex: 20 }}
            onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture unsupported — drag still works */ } setDrag(true); move(e.clientX); }}
            onPointerMove={(e) => { if (drag) move(e.clientX); }}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2.5px] bg-white pointer-events-none" style={{ boxShadow: "0 0 8px rgba(0,0,0,0.35)" }} />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full bg-white flex items-center justify-center font-bold text-zinc-700 text-[13px] pointer-events-none"
              style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
            >
              ⇔
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeedScreen({
  products, carousel, brand, logoUrl, mode, template, trackRef, onTrackScroll, carouselIdx, onDot, compare,
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
  compare?: { pos: number; onPos: (n: number) => void };
}) {
  const cards = (carousel ? products.slice(0, 12) : products.slice(0, 1));
  const active = cards[Math.min(carouselIdx, cards.length - 1)] ?? cards[0];
  const handle = brand.toLowerCase().replace(/[^a-z0-9]+/g, "") || "shop";
  const scale = 0.252; // 280px screen width / 1080 template
  // Ad CTA pulse: ink at rest, brand moss 4s after mount.
  const [ctaOn, setCtaOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCtaOn(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <StatusBar />
      <PostHeader brand={brand} logoUrl={logoUrl} />
      {carousel && trackRef ? (
        <div ref={trackRef} onScroll={onTrackScroll} className="flex overflow-x-auto snap-x snap-mandatory shrink-0" style={{ scrollbarWidth: "none" }}>
          {cards.map((p) => (
            <div key={p.id} className="snap-center shrink-0 w-full">
              <CreativeSlide product={p} mode={mode} template={template} scale={scale} compare={compare} />
            </div>
          ))}
        </div>
      ) : (
        active ? <CreativeSlide product={active} mode={mode} template={template} scale={scale} compare={compare} /> : null
      )}
      {/* IG ad CTA — white/black at rest, brand moss after 4s */}
      <div
        className="flex items-center justify-between pl-3 pr-2.5 shrink-0"
        style={{
          background: ctaOn ? MOSS : "#ffffff",
          color: ctaOn ? "#ffffff" : INK,
          borderBottom: ctaOn ? "1px solid transparent" : "1px solid #f4f4f5",
          transition: "background-color 900ms ease, color 900ms ease, border-color 900ms ease",
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <span className="text-[13.5px] font-semibold tracking-tight">Shop Now</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </div>
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
      {/* caption locked to exactly 2 lines + breathing room below, so every
          product renders the same text block above the tab bar */}
      <div className="px-2.5 pt-0.5 pb-5 text-[12px] leading-snug flex-1 min-h-0 overflow-hidden">
        {/* inline clamp (not utilities): guarantees -webkit-box isn't overridden
            and min-height applies — exactly 2 lines for every product */}
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.75em" }}>
          <span className="font-semibold">{handle}</span>{" "}
          {active && <span>{active.title} ✨ Tap to shop — <span className="text-zinc-500">#{handle} #newin</span></span>}
        </span>
      </div>
      {/* IG tab bar */}
      <IgTabBar />
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
