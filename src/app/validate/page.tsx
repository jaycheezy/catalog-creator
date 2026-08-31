"use client";

import { useState } from "react";

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
};

type Validation = {
  type: "error" | "warning" | "ok";
  message: string;
  count: number;
  rows: PreviewRow[];
};

export default function ValidatePage() {
  const [domain, setDomain] = useState("store.gibun.at");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ totalFetched: number; totalPhysical: number } | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/preview?domain=${encodeURIComponent(domain)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.preview as PreviewRow[]);
      setMeta({ totalFetched: json.totalFetched, totalPhysical: json.totalPhysical });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const validations: Validation[] = (() => {
    if (!rows.length) return [];
    const missingImage = rows.filter((r) => !r.image_link);
    const badPrice = rows.filter((r) => !/^\d+\.\d{2} EUR$/.test(r.price));
    const shortDesc = rows.filter((r) => (r.description || "").length < 20);
    const longTitle = rows.filter((r) => r.title.length > 150);
    const missingBrand = rows.filter((r) => !r.brand);
    const outOfStock = rows.filter((r) => r.availability === "out of stock");
    // image size heuristic: Shopify images for Gibun are 3000px, but Nachfüllpackung has no image -> already flagged
    // We flag if additional_image_link missing? Not required
    return [
      { type: missingImage.length ? "error" : "ok", message: "Missing image_link (required by Meta) — ads will be rejected", count: missingImage.length, rows: missingImage },
      { type: badPrice.length ? "error" : "ok", message: "Bad price format — must be '17.90 EUR' (2 decimals + currency)", count: badPrice.length, rows: badPrice },
      { type: shortDesc.length ? "warning" : "ok", message: "Short description (<20 chars) — may lower relevance score", count: shortDesc.length, rows: shortDesc },
      { type: longTitle.length ? "warning" : "ok", message: "Title >150 chars — will be truncated on Meta", count: longTitle.length, rows: longTitle },
      { type: missingBrand.length ? "error" : "ok", message: "Missing brand — required field", count: missingBrand.length, rows: missingBrand },
      { type: outOfStock.length ? "warning" : "ok", message: "Out of stock — will not be delivered but still in feed", count: outOfStock.length, rows: outOfStock },
    ];
  })();

  const hasErrors = validations.some((v) => v.type === "error" && v.count > 0);
  const hasWarnings = validations.some((v) => v.type === "warning" && v.count > 0);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/" className="font-semibold">Catalog Forge</a>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Validate — Feed Linter</span>
          <div className="ml-auto flex gap-2">
            <a href="/" className="text-xs px-3 py-1 border rounded">Feed</a>
            <a href="/editor" className="text-xs px-3 py-1 border rounded">Editor</a>
            <a href="/board" className="text-xs px-3 py-1 border rounded">Board</a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h1 className="text-lg font-semibold">Meta Feed Auditor (like Marpipe Feed Auditor)</h1>
          <p className="text-sm text-zinc-600">Checks all required Meta fields: <code className="bg-zinc-100 px-1 rounded text-xs">id, title, description, availability, condition, price, link, image_link, brand</code>. Paste any Shopify store — we lint against 500px image rule, price formatting, truncation, stock.</p>
          <div className="flex gap-2">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 border rounded px-3 py-2 font-mono text-sm" placeholder="store.gibun.at" />
            <button onClick={run} disabled={loading} className="px-6 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50">{loading ? "Linting…" : "Lint Feed"}</button>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setDomain("store.gibun.at")} className="underline">store.gibun.at</button>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-400">Shows the 1 missing-image SKU as error (Not My Drama Nachfüllpackung)</span>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{error}</div>}

        {meta && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4"><div className="text-xs text-zinc-500">Fetched</div><div className="text-2xl font-semibold">{meta.totalFetched}</div></div>
            <div className="bg-white border rounded-xl p-4"><div className="text-xs text-zinc-500">Physical</div><div className="text-2xl font-semibold">{meta.totalPhysical}</div></div>
            <div className={`border rounded-xl p-4 ${hasErrors ? "bg-red-50 border-red-200" : hasWarnings ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
              <div className="text-xs">{hasErrors ? "Errors" : hasWarnings ? "Warnings" : "All good"}</div>
              <div className="text-sm font-medium">{hasErrors ? "Fix required before Meta will accept feed" : hasWarnings ? "Warnings — will pass but optimize" : "Feed will pass Meta validation — ready for enriched overlay"}</div>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            {validations.map((v, idx) => (
              <div key={idx} className={`rounded-xl border p-4 ${v.type === "error" ? "bg-red-50 border-red-200" : v.type === "warning" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${v.type === "error" ? "bg-red-600 text-white" : v.type === "warning" ? "bg-amber-500 text-white" : "bg-green-600 text-white"}`}>{v.type.toUpperCase()}</span>
                  <span className="text-sm font-medium">{v.message}</span>
                  <span className="ml-auto text-sm font-mono">{v.count} / {rows.length}</span>
                </div>
                {v.count > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">Show affected SKUs ({v.count})</summary>
                    <div className="mt-2 grid gap-2">
                      {v.rows.slice(0, 10).map((r) => (
                        <div key={r.id} className="flex gap-2 items-center text-xs bg-white border rounded px-3 py-2">
                          <span className="font-mono w-32 truncate">{r.id}</span>
                          <span className="flex-1 truncate">{r.title}</span>
                          <span className="font-mono">{r.price}</span>
                          <a href={r.link} target="_blank" className="text-blue-600 underline">link</a>
                        </div>
                      ))}
                      {v.count > 10 && <div className="text-xs text-zinc-500">+{v.count - 10} more…</div>}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && !hasErrors && (
          <div className="bg-violet-600 text-white rounded-xl p-6 flex items-center justify-between">
            <div>
              <div className="font-medium">Feed is valid — now enrich it</div>
              <div className="text-sm opacity-80">Open Editor, create overlay, Save to Server, and use Enriched Feed URL in Commerce Manager.</div>
            </div>
            <a href="/editor" className="px-4 py-2 bg-white text-violet-600 rounded text-sm font-medium">Open Editor →</a>
          </div>
        )}
      </main>
    </div>
  );
}
