"use client";

import { useEffect, useState } from "react";

type StepId = "connect" | "validate" | "design" | "variants" | "feed" | "publish" | "test";
type LayerId = "thin" | "enhance" | "future";

type Card = {
  id: string;
  title: string;
  description: string;
  step: StepId;
  layer: LayerId;
  status: "done" | "todo" | "doing";
  effort: "S" | "M" | "L" | "XL";
  tags: string[];
};

type Step = { id: StepId; title: string; subtitle: string; goal: string };

const STEPS: Step[] = [
  { id: "connect", title: "1. Connect Store", subtitle: "Integrate product data", goal: "Get 31 Gibun teas in" },
  { id: "validate", title: "2. Clean & Validate", subtitle: "Make feed Meta-ready", goal: "0 errors before publish" },
  { id: "design", title: "3. Design Overlay", subtitle: "Brand packshots", goal: "Price badge + title" },
  { id: "variants", title: "4. Size Variants", subtitle: "Every placement", goal: "1:1, 4:5, 9:16" },
  { id: "feed", title: "5. Enriched Feed", subtitle: "Generate catalog", goal: "image_link → render" },
  { id: "publish", title: "6. Publish to Meta", subtitle: "Advertise on Facebook", goal: "Scheduled fetch" },
  { id: "test", title: "7. Test & Learn", subtitle: "Know what wins", goal: "A/B + ROAS" },
];

const LAYERS: { id: LayerId; title: string; subtitle: string; color: string }[] = [
  { id: "thin", title: "Thin Slice — must have to go live", subtitle: "End-to-end walking skeleton (already shipped for Gibun)", color: "bg-green-50 border-green-200" },
  { id: "enhance", title: "Enhance — where quality matters most", subtitle: "Next: biggest lift for advertisers", color: "bg-amber-50 border-amber-200" },
  { id: "future", title: "Future — later", subtitle: "Scale & polish", color: "bg-zinc-50 border-zinc-200" },
];

const DEFAULT_CARDS: Card[] = [
  // CONNECT
  { id: "c-connect-thin", title: "Public products.json ingest", description: "GET /products.json?limit=250, shipping filter, no auth. 36 → 31 Gibun SKUs, 1h edge cache. Done.", step: "connect", layer: "thin", status: "done", effort: "M", tags: ["shipped", "feed"] },
  { id: "c-connect-enhance1", title: "Collection / tag filter UI", description: "Checkboxes to include/exclude by Shopify collection/tag/type instead of just requires_shipping. Advertiser picks ‘only teas’ etc.", step: "connect", layer: "enhance", status: "todo", effort: "M", tags: ["next"] },
  { id: "c-connect-enhance2", title: "Admin API + OAuth (private stores)", description: "Real inventory, metafields, private stores. Token in D1, hourly sync.", step: "connect", layer: "enhance", status: "todo", effort: "L", tags: [] },
  { id: "c-connect-future", title: "Cron sync + webhooks", description: "Cloudflare cron + Shopify product/update webhook to refresh feeds automatically.", step: "connect", layer: "future", status: "todo", effort: "M", tags: [] },

  // VALIDATE
  { id: "c-validate-thin", title: "Feed linter (/validate)", description: "Flags missing image_link (1 Gibun refill bag), bad price, short desc, long title. Done.", step: "validate", layer: "thin", status: "done", effort: "S", tags: ["shipped"] },
  { id: "c-validate-enhance", title: "Image 500px + duplicate linter", description: "Check Shopify image width <500px, duplicates, aspect warnings before Meta rejects.", step: "validate", layer: "enhance", status: "todo", effort: "S", tags: ["next"] },
  { id: "c-validate-future", title: "Marpipe-style Feed Auditor page", description: "Shareable audit link per store with fix suggestions.", step: "validate", layer: "future", status: "todo", effort: "M", tags: [] },

  // DESIGN
  { id: "c-design-thin", title: "HTML editor (no canvas lib)", description: "DOM EditorCanvas, drag/resize, layers, {{price}}/{{title}} bindings, 1:1 template. Done.", step: "design", layer: "thin", status: "done", effort: "L", tags: ["shipped"] },
  { id: "c-design-thin2", title: "Template store + AI JSON", description: "POST /api/templates, localStorage, AI import/export. Save to Server. Done.", step: "design", layer: "thin", status: "done", effort: "M", tags: ["shipped"] },
  { id: "c-design-enhance1", title: "Conditional logic (IF discount then badge)", description: "Per-layer visibleIf: show sale badge only when discount_pct>0, green frame for Bio.", step: "design", layer: "enhance", status: "todo", effort: "L", tags: ["next"] },
  { id: "c-design-enhance2", title: "Brand kit + asset library", description: "Upload logo/palette/fonts once, reuse across templates. R2.", step: "design", layer: "enhance", status: "todo", effort: "M", tags: [] },
  { id: "c-design-future1", title: "Smart crop & focal point", description: "Contain vs cover + focal picker for 5472×3648 lifestyle vs 3000×3000 packshots.", step: "design", layer: "future", status: "todo", effort: "M", tags: [] },
  { id: "c-design-future2", title: "BG removal + history/undo", description: "One-click Cloudflare Images backgroundRemoval + version history.", step: "design", layer: "future", status: "todo", effort: "M", tags: [] },

  // VARIANTS
  { id: "c-variants-thin", title: "Auto-layout 1:1 → 4:5 / 9:16", description: "One master stretches: bottom-anchored price/title keep distance, product image fills. Done — All sizes preview + Save all variants.", step: "variants", layer: "thin", status: "done", effort: "M", tags: ["shipped"] },
  { id: "c-variants-enhance", title: "Per-placement tweaks", description: "Allow 9:16 to hide long titles or move badge safe-zone for Stories.", step: "variants", layer: "enhance", status: "todo", effort: "M", tags: ["next"] },
  { id: "c-variants-future", title: "HTML ad export (300×250, 728×90)", description: "Same template as HTML5 display ad bundle, no raster.", step: "variants", layer: "future", status: "todo", effort: "M", tags: [] },

  // FEED
  { id: "c-feed-thin", title: "Server raster + enriched feed", description: "GET /api/render (next/og) + GET /api/feed?templateId= swaps image_link to render URLs. 31 rows, 761KB PNG. Done.", step: "feed", layer: "thin", status: "done", effort: "M", tags: ["shipped"] },
  { id: "c-feed-enhance", title: "R2 cache + hourly refresh", description: "Cache renders in Renders bucket, invalidate on product update.", step: "feed", layer: "enhance", status: "todo", effort: "M", tags: [] },
  { id: "c-feed-future", title: "Multiple feeds per store", description: "One feed per size variant for different placements.", step: "feed", layer: "future", status: "todo", effort: "S", tags: [] },

  // PUBLISH
  { id: "c-publish-thin", title: "Manual publish (copy feed URL)", description: "Enriched CSV URL pasted into Commerce Manager → Data Sources → Scheduled fetch. Done — works today.", step: "publish", layer: "thin", status: "done", effort: "S", tags: ["shipped"] },
  { id: "c-publish-enhance", title: "Meta Catalog API direct push", description: "One-click push to catalog via Batch API, no copy/paste, show sync status.", step: "publish", layer: "enhance", status: "todo", effort: "M", tags: ["next"] },
  { id: "c-publish-future", title: "TikTok / Pinterest adapters", description: "Same feed → other placements, format mapper.", step: "publish", layer: "future", status: "todo", effort: "M", tags: [] },

  // TEST
  { id: "c-test-thin", title: "Manual A/B via two feeds", description: "Save v1/v2 templates → two feed URLs → two ad sets for manual test. Possible today.", step: "test", layer: "thin", status: "todo", effort: "S", tags: [] },
  { id: "c-test-enhance1", title: "Versioned feeds + UTM builder", description: "Templates v1/v2/v3 with side-by-side preview, utm_campaign per template for Shopify/GA lift.", step: "test", layer: "enhance", status: "todo", effort: "M", tags: ["next"] },
  { id: "c-test-enhance2", title: "ROAS dashboard", description: "Pull Meta Insights to show plain vs enriched CTR (~20% lift).", step: "test", layer: "enhance", status: "todo", effort: "L", tags: [] },
  { id: "c-test-future", title: "Auto-optimize (kill losers)", description: "Marpipe SKU optimization: hide worst performers automatically.", step: "test", layer: "future", status: "todo", effort: "L", tags: [] },
];

const STORAGE_KEY = "catalog-forge-storymap-v1";

export default function StoryMapPage() {
  const [cards, setCards] = useState<Card[]>(DEFAULT_CARDS);
  const [dragged, setDragged] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Card[];
        if (Array.isArray(parsed) && parsed.length) setCards(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const moveCard = (id: string, step: StepId, layer: LayerId) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, step, layer } : c)));
  };

  const toggleDone = (id: string) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: c.status === "done" ? "todo" : "done" } : c)));
  };

  const categories = Array.from(new Set(cards.map((c) => c.step))).sort();

  const thinSlice = cards.filter((c) => c.layer === "thin");
  const thinDone = thinSlice.filter((c) => c.status === "done").length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/" className="font-semibold tracking-tight">Catalog Forge</a>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Story Map — End-to-end thin slice</span>
          <div className="ml-auto flex items-center gap-2">
            <a href="/editor" className="text-xs px-3 py-1 border rounded">Editor</a>
            <a href="/validate" className="text-xs px-3 py-1 border rounded">Validate</a>
            <a href="/board" className="text-xs px-3 py-1 border rounded">Board (old)</a>
            <button onClick={() => { if (confirm("Reset map to defaults?")) setCards(DEFAULT_CARDS); }} className="text-xs px-3 py-1 border rounded">Reset</button>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 pb-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="text-sm">
              <span className="font-medium text-green-800">Thin slice ready for Gibun:</span> <span className="font-mono text-green-700">{thinDone}/{thinSlice.length} done</span> — you can go from store URL to live Meta ads today. Drag cards between rows to reprioritize where quality matters next.
            </div>
            <div className="sm:ml-auto flex gap-2">
              <a href="/" className="text-xs px-3 py-1.5 bg-green-600 text-white rounded">Try thin slice →</a>
              <a href="/editor" className="text-xs px-3 py-1.5 bg-white border rounded">Open Editor</a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto w-full px-4 py-4">
        <div className="flex gap-2 text-xs mb-3">
          <span className="text-zinc-500">Filter step:</span>
          <button onClick={() => setFilter("all")} className={`px-2 py-1 rounded-full border text-xs ${filter === "all" ? "bg-zinc-900 text-white" : "bg-white"}`}>All steps</button>
          {STEPS.map((s) => (
            <button key={s.id} onClick={() => setFilter(s.id)} className={`px-2 py-1 rounded-full border text-xs ${filter === s.id ? "bg-zinc-900 text-white" : "bg-white"}`}>{s.title.replace(/^\d+\.\s/, "")}</button>
          ))}
        </div>

        <div className="border rounded-xl bg-white overflow-auto">
          {/* Backbone header */}
          <div className="grid" style={{ gridTemplateColumns: `160px repeat(${STEPS.length}, 1fr)` }}>
            <div className="border-r border-b bg-zinc-50 p-3 sticky left-0 z-10">
              <div className="text-xs font-medium">User journey →</div>
              <div className="text-[11px] text-zinc-500">Left to right = end-to-end flow</div>
            </div>
            {STEPS.map((step) => (
              <div key={step.id} className={`border-r border-b p-3 text-center ${filter !== "all" && filter !== step.id ? "opacity-30" : ""}`}>
                <div className="text-xs font-semibold">{step.title}</div>
                <div className="text-[11px] text-zinc-500">{step.subtitle}</div>
                <div className="text-[10px] text-violet-600 font-mono mt-1">{step.goal}</div>
              </div>
            ))}
          </div>

          {/* Layers */}
          {LAYERS.map((layer) => (
            <div key={layer.id} className="grid" style={{ gridTemplateColumns: `160px repeat(${STEPS.length}, 1fr)` }}>
              <div className={`border-r border-b p-3 flex flex-col justify-center ${layer.color} sticky left-0 z-10`}>
                <div className="text-xs font-medium">{layer.title}</div>
                <div className="text-[11px] text-zinc-500">{layer.subtitle}</div>
                <div className="text-[10px] font-mono mt-1">{DEFAULT_CARDS.filter((c) => c.layer === layer.id).length} cards</div>
              </div>
              {STEPS.map((step) => {
                const stepCards = cards.filter((c) => c.step === step.id && c.layer === layer.id && (filter === "all" || filter === step.id));
                return (
                  <div
                    key={step.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) moveCard(id, step.id, layer.id);
                      setDragged(null);
                    }}
                    className={`border-r border-b p-2 min-h-[140px] space-y-2 align-top ${layer.color} ${filter !== "all" && filter !== step.id ? "opacity-30" : ""}`}
                  >
                    {stepCards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); setDragged(card.id); }}
                        onDragEnd={() => setDragged(null)}
                        className={`bg-white rounded-lg border p-2.5 shadow-sm text-xs cursor-grab active:cursor-grabbing ${card.status === "done" ? "border-green-300 bg-green-50/50" : ""} ${dragged === card.id ? "opacity-50 ring-2 ring-violet-300" : ""}`}
                      >
                        <div className="flex items-start gap-1">
                          <button onClick={() => toggleDone(card.id)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${card.status === "done" ? "bg-green-600 border-green-600 text-white" : "bg-white"}`}>{card.status === "done" ? "✓" : ""}</button>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium leading-tight ${card.status === "done" ? "line-through text-zinc-500" : ""}`}>{card.title}</div>
                            <div className="text-[11px] text-zinc-600 leading-snug mt-1 line-clamp-3">{card.description}</div>
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              <span className="text-[10px] px-1 py-0.5 bg-zinc-100 border rounded font-mono">{card.effort}</span>
                              {card.tags.includes("shipped") && <span className="text-[10px] px-1 py-0.5 bg-green-600 text-white rounded">shipped</span>}
                              {card.tags.includes("next") && <span className="text-[10px] px-1 py-0.5 bg-amber-500 text-white rounded">next</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stepCards.length === 0 && <div className="text-[11px] text-zinc-400 text-center py-6">Drop here</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2 text-xs text-zinc-500">
          <span>Click ✓ to mark done • Drag between rows/steps to reprioritize • Thin slice (top green row) is your walking skeleton — keep it shippable, improve quality in Enhance row where it lifts ROAS.</span>
          <span className="sm:ml-auto">View: <a href="/board" className="underline">Board</a> • <a href="/validate" className="underline">Validate</a> • <a href="/editor" className="underline">Editor</a></span>
        </div>
      </div>
    </div>
  );
}
