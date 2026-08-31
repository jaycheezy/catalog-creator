"use client";

import { useEffect, useState } from "react";

type ColumnId = "backlog" | "next" | "doing" | "done";

type Card = {
  id: string;
  title: string;
  description: string;
  column: ColumnId;
  category: string;
  effort: "S" | "M" | "L" | "XL";
  impact: "High" | "Medium" | "Low";
  tags: string[];
};

type Column = { id: ColumnId; title: string; subtitle: string; color: string };

const COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", subtitle: "All ideas — drag to prioritize", color: "bg-zinc-100" },
  { id: "next", title: "Up Next", subtitle: "Highest impact — do soon", color: "bg-violet-50" },
  { id: "doing", title: "In Progress", subtitle: "Active work", color: "bg-amber-50" },
  { id: "done", title: "Done / Shipped", subtitle: "Completed", color: "bg-green-50" },
];

const DEFAULT_CARDS: Card[] = [
  { id: "c1", title: "✅ Shipped: Server raster HTML → PNG (next/og)", description: "DONE 30 Aug — Worker renders Template HTML to PNG via next/og ImageResponse. GET /api/render?templateId=xxx&handle=... returns 1080×1080 PNG (761KB). Replaces client foreignObject CORS issue. Verified with Gibun notmydrama.", column: "done", category: "Rendering", effort: "M", impact: "High", tags: ["shipped", "feed", "editor"] },
  { id: "c2", title: "✅ Shipped: Bulk enriched feed", description: "DONE 30 Aug — GET /api/feed?domain=store.gibun.at&templateId=xxx swaps every image_link to /api/render... (31 rows). Meta fetches server PNGs. Tested end-to-end.", column: "done", category: "Feed", effort: "M", impact: "High", tags: ["shipped", "feed"] },
  { id: "c9", title: "✅ Shipped: Feed validation & FB linter (/validate)", description: "DONE 30 Aug — /validate lints missing image_link (flags 1 Gibun refill bag), bad price, short desc, long title, missing brand, out-of-stock. Like Marpipe Feed Auditor.", column: "done", category: "Feed", effort: "S", impact: "High", tags: ["shipped", "QA"] },
  { id: "c22", title: "✅ Shipped: Onboarding & empty states", description: "DONE 30 Aug — 4-step modal on /: paste store → see before/after (plain vs branded) → lint → editor → enriched feed. Before/after cards show Gibun packshot transformation.", column: "done", category: "Growth", effort: "S", impact: "High", tags: ["shipped", "UX"] },
  { id: "c24", title: "✅ Shipped: Public feed (/api/feed + /api/preview)", description: "Shipped: Shopify products.json ingestion, shipping filter, CSV with all Meta required headers, 1h cache. 31 Gibun rows.", column: "done", category: "Feed", effort: "M", impact: "High", tags: ["shipped"] },
  { id: "c25", title: "✅ Shipped: HTML editor MVP (no canvas lib)", description: "Shipped: pure DOM EditorCanvas, TemplateRenderer, drag/resize, layers, properties, bindings {{price}}, size presets (1:1,4:5,9:16), PNG via server, localStorage, AI JSON import/export + Save to Server.", column: "done", category: "Editor", effort: "L", impact: "High", tags: ["shipped"] },
  { id: "c26", title: "✅ Shipped: Template store (R2 + file fallback)", description: "DONE 30 Aug — POST /api/templates persists to R2 (TEMPLATES_BUCKET) with file fallback for local dev (/tmp/catalog-forge-templates.json). Editor Save to Server + enriched feed bar.", column: "done", category: "Rendering", effort: "M", impact: "High", tags: ["shipped", "infra"] },
  // Next priorities — moved to Up Next
  { id: "c3", title: "✅ Shipped: Auto-layout for size variants", description: "DONE 30 Aug — Single master → 4 sizes (1:1, 4:5, 9:16, 1.91:1) auto-adapted. Bottom-anchored title/price keeps distance from bottom, product image stretches (1080×1080 → 1080×1920). Preview grid in Editor + Save all variants.", column: "done", category: "Editor", effort: "M", impact: "High", tags: ["shipped", "editor"] },
  { id: "c4", title: "Conditional logic engine", description: "IF discount_pct>0 THEN show sale badge, IF tags contains 'Bio' THEN green frame. Rule builder UI + per-layer visibleIf. Marpipe parity.", column: "next", category: "Editor", effort: "L", impact: "High", tags: ["editor", "rules"] },
  { id: "c10", title: "Multi-template versioning + A/B feeds", description: "Templates v1/v2/v3 -> separate feeds /api/feed?templateId=v1 vs v2 for catalog A/B testing (Meta Treatments, 3 limit startup). Compare previews side-by-side.", column: "next", category: "Testing", effort: "M", impact: "High", tags: ["testing", "feeds"] },
  { id: "c7", title: "Product sets / collection filter UI", description: "Better than requires_shipping filter. Let advertiser include/exclude by Shopify collection, tag, product_type. UI with checkboxes -> feed rows filtered.", column: "next", category: "Feed", effort: "M", impact: "High", tags: ["feed", "filtering"] },
  // Backlog remainder
  { id: "c5", title: "Smart crop & focal point", description: "Gibun images are 3000×3000 vs 5472×3648 lifestyle. Choose contain vs cover per layer + focal point picker so packs aren't cropped awkwardly.", column: "backlog", category: "Editor", effort: "M", impact: "Medium", tags: ["editor", "images"] },
  { id: "c6", title: "Background removal toggle", description: "Cloudflare Images backgroundRemoval on product-image layer. One click to remove white packshot bg for premium overlays.", column: "backlog", category: "Editor", effort: "M", impact: "Medium", tags: ["images", "AI"] },
  { id: "c8", title: "Brand kit (fonts/colors/logos per merchant)", description: "Store brand assets once: logo, palette, heading font. Templates pull from kit so Gibun vs next client not mixed. Upload to R2.", column: "backlog", category: "Editor", effort: "M", impact: "Medium", tags: ["editor", "assets"] },
  { id: "c11", title: "UTM & tracking builder per template", description: "Append utm_source=meta&utm_campaign={{templateId}} per enriched link so advertiser measures lift in Shopify/GA.", column: "backlog", category: "Testing", effort: "S", impact: "Medium", tags: ["testing", "analytics"] },
  { id: "c12", title: "Shopify Admin API + OAuth (private stores)", description: "Beyond public /products.json: real inventory, metafields, private stores. OAuth flow, token storage in D1, hourly sync.", column: "backlog", category: "Infrastructure", effort: "L", impact: "High", tags: ["shopify", "auth"] },
  { id: "c13", title: "Cron sync + webhooks", description: "Daily fetch of Shopify products -> refresh enriched renders. Cloudflare Cron Triggers + Shopify webhook for product/update.", column: "backlog", category: "Infrastructure", effort: "M", impact: "High", tags: ["infra", "cloudflare"] },
  { id: "c14", title: "Asset library (R2 uploads)", description: "Upload logos, frames, badges, backgrounds. Reusable across templates. Drag from library into canvas.", column: "backlog", category: "Editor", effort: "M", impact: "Medium", tags: ["assets"] },
  { id: "c15", title: "History / versions / undo", description: "Template version history, diff, restore. Crucial before AI agents start auto-editing JSON.", column: "backlog", category: "Editor", effort: "M", impact: "Medium", tags: ["editor", "DX"] },
  { id: "c16", title: "HTML ad export (IAB 300×250, 728×90)", description: "Reuse HTML template as display HTML5 ad (no raster). Export bundle with inline CSS. Your stated future need.", column: "backlog", category: "Growth", effort: "M", impact: "Medium", tags: ["HTML ads"] },
  { id: "c17", title: "Product Level Video (image → video)", description: "Ken-burns + text overlay video per SKU for Reels. Marpipe PLV parity. Needs rendering pipeline (ffmpeg on Workers?).", column: "backlog", category: "Growth", effort: "XL", impact: "Medium", tags: ["video"] },
  { id: "c18", title: "Generative AI backgrounds & copy", description: "AI generate premium backdrops per product type + rewrite {{description}}. Requires prompt templates + cost controls.", column: "backlog", category: "Growth", effort: "L", impact: "Low", tags: ["AI", "generative"] },
  { id: "c19", title: "Analytics dashboard (CTR/ROAS lift)", description: "Pull Meta Insights API to show plain vs enriched CTR. Marpipe live metrics parity (~20% lift claim).", column: "backlog", category: "Testing", effort: "L", impact: "Medium", tags: ["analytics"] },
  { id: "c20", title: "Auth, multi-tenant, teams & workspaces", description: "NextAuth + D1, per-merchant templates/feeds. Invite team, role per store.", column: "backlog", category: "Infrastructure", effort: "L", impact: "Low", tags: ["auth", "teams"] },
  { id: "c21", title: "Billing & pricing tiers (Stripe)", description: "Free / $199 startup (500 SKUs, 1 feed, 3 designs) mirroring Marpipe. Entitlement checks on render counts.", column: "backlog", category: "Growth", effort: "M", impact: "Low", tags: ["billing"] },
  { id: "c23", title: "Collaboration & comments (Figma-like)", description: "Comment pins on canvas, share template link for feedback. Lower priority until teams exist.", column: "backlog", category: "Growth", effort: "M", impact: "Low", tags: ["collab"] },
];

const STORAGE_KEY = "catalog-forge-board-v3";

export default function BoardPage() {
  const [cards, setCards] = useState<Card[]>(DEFAULT_CARDS);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);

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

  const categories = Array.from(new Set(cards.map((c) => c.category))).sort();

  const filtered = cards.filter((c) => {
    if (filter !== "all" && c.category !== filter) return false;
    if (search && !`${c.title} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byColumn = (col: ColumnId) => filtered.filter((c) => c.column === col);

  const moveCard = (id: string, to: ColumnId) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column: to } : c)));
  };

  const onDrop = (e: React.DragEvent, col: ColumnId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveCard(id, col);
    setDragged(null);
  };

  const deleteCard = (id: string) => setCards((p) => p.filter((c) => c.id !== id));
  const duplicateCard = (id: string) => {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    setCards((p) => [...p, { ...c, id: `c_${Math.random().toString(36).slice(2, 6)}`, title: c.title + " (copy)" }]);
  };

  const addCard = (col: ColumnId) => {
    if (!newTitle.trim()) return;
    const card: Card = {
      id: `c_${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle.trim(),
      description: newDesc.trim() || "Add description…",
      column: col,
      category: "Custom",
      effort: "M",
      impact: "Medium",
      tags: ["custom"],
    };
    setCards((p) => [...p, card]);
    setNewTitle("");
    setNewDesc("");
  };

  const updateCard = (id: string, patch: Partial<Card>) => setCards((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/" className="font-semibold tracking-tight">Catalog Forge</a>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Board — Roadmap & Prioritization</span>
          <span className="text-xs px-2 py-0.5 bg-amber-100 border border-amber-200 rounded">Deprecated — see Story Map</span>
          <div className="ml-auto flex items-center gap-2">
            <a href="/story-map" className="text-xs px-3 py-1 bg-zinc-900 text-white rounded">Story Map →</a>
            <a href="/editor" className="text-xs px-3 py-1 border rounded">Editor</a>
            <a href="/" className="text-xs px-3 py-1 border rounded">Feed</a>
            <button onClick={() => { if (confirm("Reset board to defaults?")) setCards(DEFAULT_CARDS); }} className="text-xs px-3 py-1 border rounded">Reset</button>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(cards, null, 2)); alert("Board JSON copied"); }} className="text-xs px-3 py-1 bg-zinc-900 text-white rounded">Copy JSON</button>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 pb-3 flex flex-wrap gap-2 items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cards, tags…" className="border rounded px-3 py-1.5 text-sm w-64" />
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilter("all")} className={`px-2.5 py-1 rounded-full text-xs border ${filter === "all" ? "bg-zinc-900 text-white" : "bg-white"}`}>All</button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-2.5 py-1 rounded-full text-xs border ${filter === cat ? "bg-zinc-900 text-white" : "bg-white"}`}>{cat}</button>
            ))}
          </div>
          <span className="ml-auto text-xs text-zinc-500">{filtered.length} cards • drag between columns to prioritize • persisted locally</span>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[1100px] p-4 grid grid-cols-4 gap-4 max-w-[1600px] mx-auto">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, col.id)}
              className={`rounded-xl border flex flex-col min-h-[600px] ${col.color} ${dragged ? "ring-1 ring-blue-200" : ""}`}
            >
              <div className="p-3 border-b bg-white/80 backdrop-blur rounded-t-xl sticky top-0">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-white font-mono">{byColumn(col.id).length}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">{col.subtitle}</p>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-auto">
                {byColumn(col.id).map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); setDragged(card.id); }}
                    onDragEnd={() => setDragged(null)}
                    className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow cursor-grab active:cursor-grabbing ${dragged === card.id ? "opacity-50" : ""} ${editing === card.id ? "ring-2 ring-violet-300" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editing === card.id ? (
                          <input
                            autoFocus
                            value={card.title}
                            onChange={(e) => updateCard(card.id, { title: e.target.value })}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                            className="w-full border rounded px-2 py-1 text-sm font-medium"
                          />
                        ) : (
                          <h3 onDoubleClick={() => setEditing(card.id)} className="text-sm font-medium leading-tight truncate" title={card.title}>{card.title}</h3>
                        )}
                        <p className="text-xs text-zinc-600 mt-1 leading-relaxed line-clamp-3" title={card.description}>{card.description}</p>
                      </div>
                      <button onClick={() => setEditing(editing === card.id ? null : card.id)} className="text-[11px] px-1.5 py-0.5 border rounded shrink-0">{editing === card.id ? "Done" : "Edit"}</button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 border font-mono">{card.category}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded border font-mono ${card.effort === "S" ? "bg-green-50" : card.effort === "M" ? "bg-amber-50" : "bg-red-50"}`}>Effort {card.effort}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded border ${card.impact === "High" ? "bg-violet-600 text-white" : card.impact === "Medium" ? "bg-violet-50" : "bg-zinc-50"}`}>{card.impact} impact</span>
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {card.tags.map((t) => (
                          <span key={t} className="text-[10px] px-1 py-0.5 bg-zinc-50 border rounded font-mono">#{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-3">
                      <select value={card.column} onChange={(e) => moveCard(card.id, e.target.value as ColumnId)} className="text-xs border rounded px-2 py-1 flex-1">
                        {COLUMNS.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                      <button onClick={() => duplicateCard(card.id)} className="text-xs px-2 py-1 border rounded" title="Duplicate">⎘</button>
                      <button onClick={() => deleteCard(card.id)} className="text-xs px-2 py-1 border rounded text-red-600" title="Delete">×</button>
                    </div>
                    {editing === card.id && (
                      <div className="mt-2 space-y-2">
                        <textarea value={card.description} onChange={(e) => updateCard(card.id, { description: e.target.value })} rows={3} className="w-full border rounded px-2 py-1 text-xs" placeholder="Description" />
                        <div className="grid grid-cols-3 gap-1">
                          <select value={card.category} onChange={(e) => updateCard(card.id, { category: e.target.value })} className="border rounded px-1 py-1 text-xs">
                            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value="Custom">Custom</option>
                          </select>
                          <select value={card.effort} onChange={(e) => updateCard(card.id, { effort: e.target.value as Card["effort"] })} className="border rounded px-1 py-1 text-xs">
                            <option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option>
                          </select>
                          <select value={card.impact} onChange={(e) => updateCard(card.id, { impact: e.target.value as Card["impact"] })} className="border rounded px-1 py-1 text-xs">
                            <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                          </select>
                        </div>
                        <input value={card.tags.join(", ")} onChange={(e) => updateCard(card.id, { tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="tags, comma separated" className="w-full border rounded px-2 py-1 text-xs font-mono" />
                      </div>
                    )}
                  </div>
                ))}

                <div className="bg-white/70 rounded-lg border border-dashed p-3 space-y-2">
                  <div className="text-xs font-medium">Add card to {col.title}</div>
                  <input value={col.id === "backlog" ? newTitle : ""} onChange={(e) => setNewTitle(e.target.value)} placeholder="New card title…" className="w-full border rounded px-2 py-1.5 text-xs" onKeyDown={(e) => e.key === "Enter" && addCard(col.id)} />
                  {col.id === "backlog" && (
                    <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full border rounded px-2 py-1 text-xs" />
                  )}
                  <button onClick={() => addCard(col.id)} disabled={!newTitle.trim()} className="w-full py-1.5 bg-zinc-900 text-white rounded text-xs disabled:opacity-40">+ Add</button>
                  <p className="text-[11px] text-zinc-500">Tip: drag any card here from another column, or select column via dropdown.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t bg-white px-4 py-3 flex flex-col sm:flex-row gap-2 items-center text-xs text-zinc-500 max-w-[1600px] mx-auto w-full">
        <span>Double-click title to edit • Drag to reorder priority • Persists to localStorage • Use <code className="bg-zinc-100 px-1 rounded">Copy JSON</code> to share board</span>
        <span className="sm:ml-auto">Updated 30 Aug — <strong className="text-green-700">8 shipped</strong> to Done. Next: <strong className="text-zinc-800">Conditional logic, A/B feeds, Product sets</strong> in “Up Next”.</span>
      </footer>
    </div>
  );
}
