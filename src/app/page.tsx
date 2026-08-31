"use client";

import { useState } from "react";
import { Onboarding } from "@/components/Onboarding";

type PreviewRow = {
  id: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  price: string;
  link: string;
  image_link: string;
  brand: string;
  additional_image_link: string;
  item_group_id: string;
  google_product_category: string;
  sale_price: string;
};

type PreviewResponse = {
  domain: string;
  totalFetched: number;
  totalPhysical: number;
  totalVariants: number;
  issues: string[];
  preview: PreviewRow[];
  diagnostics?: {
    filteredOut: number;
    sampleFilteredOut: { title: string; handle: string; requires_shipping: boolean }[];
  };
  error?: string;
};

const DEFAULT_DOMAIN = "store.gibun.at";

export default function Home() {
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/preview?domain=${encodeURIComponent(domain)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const feedUrl = typeof window !== "undefined" ? `${window.location.origin}/api/feed?domain=${encodeURIComponent(domain)}` : `/api/feed?domain=${encodeURIComponent(domain)}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Catalog Forge</h1>
            <p className="text-sm text-zinc-500">Shopify → Facebook Catalog (CSV) — Cloudflare Ready</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/story-map" className="text-xs px-3 py-1.5 bg-zinc-900 text-white rounded-full font-medium">Story Map</a>
            <a href="/validate" className="text-xs px-3 py-1.5 border rounded-full font-medium">Validate</a>
            <a href="/editor" className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-full font-medium">Open HTML Editor →</a>
            <a
              href="https://developers.facebook.com/docs/commerce-platform/catalog/"
              target="_blank"
              className="text-xs text-zinc-500 hover:text-zinc-900 underline"
            >
              Meta Catalog Docs
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Input */}
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h2 className="font-medium">1. Connect Shopify Store</h2>
          <p className="text-sm text-zinc-600">
            Paste any Shopify storefront URL. We fetch <code className="bg-zinc-100 px-1 py-0.5 rounded text-xs">/products.json</code> (public) — no API key needed for MVP. Test with <span className="font-mono">store.gibun.at</span> (36 products, ~10 workshops filtered).
          </p>
          <div className="flex gap-3">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="store.gibun.at"
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-mono bg-white"
            />
            <button
              onClick={fetchPreview}
              disabled={loading || !domain.trim()}
              className="rounded-lg bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-black transition"
            >
              {loading ? "Fetching…" : "Preview Products"}
            </button>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setDomain("store.gibun.at")} className="underline text-zinc-600">store.gibun.at</button>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-400">Try: allbirds.com, gymshark.com (any Shopify with /products.json)</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Fetched" value={data.totalFetched} sub="raw products.json" />
              <Stat label="Physical" value={data.totalPhysical} sub="after shipping filter" />
              <Stat label="Variants / Rows" value={data.totalVariants} sub="CSV rows" />
              <Stat label="Filtered out" value={data.diagnostics?.filteredOut ?? 0} sub="workshops etc." />
            </div>

            {data.issues.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <strong className="text-amber-900">Validation warnings:</strong>
                <ul className="list-disc ml-5 mt-1 text-amber-800">
                  {data.issues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Feed URL */}
            <div className="bg-white rounded-xl border p-6 shadow-sm space-y-3">
              <h2 className="font-medium">2. Your Facebook Feed URL</h2>
              <p className="text-sm text-zinc-600">Hosted CSV — paste this into Meta Business Manager → Commerce Manager → Data Sources → Add Items → Use Data Feed → Enter URL (Scheduled Fetch).</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-zinc-900 text-zinc-100 rounded-lg px-4 py-3 text-xs font-mono break-all">{feedUrl}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(feedUrl);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-50 shrink-0"
                >
                  Copy
                </button>
                <a href={feedUrl} target="_blank" className="rounded-lg bg-white border px-4 py-2 text-sm font-medium hover:bg-zinc-50 shrink-0">
                  Download CSV
                </a>
              </div>
              <p className="text-xs text-zinc-500">Headers: id, title, description, availability, condition, price, link, image_link, brand, additional_image_link, item_group_id, google_product_category, sale_price, inventory — all required by Meta. Cached 1h on edge, revalidated every 5m.</p>
              {data.diagnostics?.sampleFilteredOut && data.diagnostics.sampleFilteredOut.length > 0 && (
                <details className="text-xs text-zinc-600">
                  <summary className="cursor-pointer">Filtered out (sample): {data.diagnostics.sampleFilteredOut.length} items</summary>
                  <ul className="mt-2 list-disc ml-4 font-mono">
                    {data.diagnostics.sampleFilteredOut.map((s) => (
                      <li key={s.handle}>{s.title} — {s.handle} (requires_shipping: {String(s.requires_shipping)})</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Preview Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-medium">3. Preview (first {data.preview.length} variants)</h2>
                <span className="text-xs text-zinc-500">Shopify → Meta mapping — one row per variant</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Image</th>
                      <th className="text-left px-4 py-2 font-medium">id (sku/variant)</th>
                      <th className="text-left px-4 py-2 font-medium">Title</th>
                      <th className="text-left px-4 py-2 font-medium">Price</th>
                      <th className="text-left px-4 py-2 font-medium">Availability</th>
                      <th className="text-left px-4 py-2 font-medium">Brand</th>
                      <th className="text-left px-4 py-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.preview.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2">
                          {r.image_link ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_link} alt="" className="w-12 h-12 object-cover rounded border" />
                          ) : (
                            <div className="w-12 h-12 bg-zinc-100 rounded border" />
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                        <td className="px-4 py-2 max-w-[260px] truncate" title={r.title}>{r.title}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.price}{r.sale_price ? ` (sale ${r.sale_price})` : ""}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.availability === "in stock" ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}>{r.availability}</span>
                        </td>
                        <td className="px-4 py-2 text-xs">{r.brand}</td>
                        <td className="px-4 py-2">
                          <a href={r.link} target="_blank" className="text-xs text-blue-600 hover:underline truncate max-w-[180px] inline-block">{r.link}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 bg-zinc-50 text-xs text-zinc-500">
                CSV will contain all {data.totalVariants} rows. Upload to Facebook → Catalog → Data Sources → Data Feed → Scheduled.
              </div>
            </div>

            {/* How to use */}
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h3 className="font-medium mb-2">How to add to Facebook</h3>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-zinc-700">
                <li>Download CSV or copy feed URL above.</li>
                <li>Go to <a href="https://business.facebook.com/commerce" target="_blank" className="underline">Commerce Manager</a> → Your Catalog → Data Sources.</li>
                <li>Add Items → Data Feed → Enter URL → Paste: <code className="bg-zinc-100 px-1 rounded text-xs">{feedUrl}</code> → Set schedule (daily).</li>
                <li>Facebook will validate required fields: id, title, description, availability, condition, price, link, image_link, brand — all included.</li>
                <li>Use catalog in Advantage+ Shopping / Catalog Sales campaigns.</li>
              </ol>
            </div>
          </>
        )}

        {!data && !error && !loading && (
          <div className="text-center py-12 text-sm text-zinc-500">
            Enter a Shopify domain and click Preview — or just press Preview to test <code className="bg-zinc-100 px-1 rounded">store.gibun.at</code>.
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-xs text-zinc-400 flex gap-4">
        <span>MVP scope: Shopify public <code>/products.json</code> → Facebook CSV. No edits — sync is source of truth.</span>
        <a href="/validate" className="underline">Validate</a>
        <a href="/story-map" className="underline">Story Map</a>
        <a href="/board" className="underline">Board (old)</a>
      </footer>
      <Onboarding />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-zinc-400">{sub}</div>
    </div>
  );
}
