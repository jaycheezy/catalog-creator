"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { LayersPanel } from "@/editor/LayersPanel";
import { PropertiesPanel } from "@/editor/PropertiesPanel";
import { createDefaultTemplate, SIZE_PRESETS, getPresetById, TEMPLATE_JSON_SCHEMA } from "@/editor/types";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import type { Template, Layer } from "@/editor/types";
import type { FeedRow } from "@/lib/facebook";

const STORAGE_KEY = "catalog-forge-templates-v1";
const DOMAIN_KEY = "catalog-forge-editor-domain";

export default function EditorPage() {
  const [templates, setTemplates] = useState<Template[]>(() => [createDefaultTemplate("1:1")]);
  const [activeId, setActiveId] = useState<string>(() => templates[0].id);
  const [selectedId, setSelectedId] = useState<string | null>("layer_title");
  const [scale, setScale] = useState(0.42);
  const [domain, setDomain] = useState("store.gibun.at");
  const [products, setProducts] = useState<FeedRow[]>([]);
  const [productIdx, setProductIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => templates.find((t) => t.id === activeId) ?? templates[0], [templates, activeId]);
  const product = products[productIdx] ?? null;

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Template[];
        if (parsed.length) {
          setTemplates(parsed);
          setActiveId(parsed[0].id);
        }
      }
      const d = localStorage.getItem(DOMAIN_KEY);
      if (d) setDomain(d);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(DOMAIN_KEY, domain);
  }, [domain]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/preview?domain=${encodeURIComponent(domain)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProducts(json.preview as FeedRow[]);
      setProductIdx(0);
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateActive = (patch: Partial<Template> | Template) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id !== activeId) return t;
        if ("layers" in patch && (patch as Template).layers) return patch as Template;
        return { ...t, ...patch, updatedAt: Date.now() } as Template;
      })
    );
  };

  const updateLayer = (id: string, patch: Partial<Layer> | ((l: Layer) => Partial<Layer>)) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id !== activeId
          ? t
          : {
              ...t,
              layers: t.layers.map((l) => {
                if (l.id !== id) return l;
                const p = typeof patch === "function" ? patch(l) : patch;
                return { ...l, ...p, style: p.style ? { ...l.style, ...p.style } : l.style };
              }),
              updatedAt: Date.now(),
            }
      )
    );
  };

  const addLayer = (type: Layer["type"]) => {
    const layer: Layer = {
      id: `layer_${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: type === "text" ? "New Text" : type === "badge" ? "New Badge" : "New Shape",
      x: active.width / 2 - 150,
      y: active.height / 2 - 40,
      w: 300,
      h: type === "shape" ? 120 : 64,
      rotation: 0,
      z: active.layers.length + 1,
      visible: true,
      locked: false,
      style:
        type === "badge"
          ? { background: "#111", color: "#fff", fontSize: 32, fontWeight: 700, borderRadius: 999, textAlign: "center" }
          : type === "shape"
            ? { background: "#f4f4f5", borderRadius: 16 }
            : { color: "#111", fontSize: 36, fontWeight: 600, textAlign: "center" },
      content: type === "text" ? "Edit me — {{title}}" : type === "badge" ? "{{price}}" : undefined,
    };
    updateActive({ ...active, layers: [...active.layers, layer] });
    setSelectedId(layer.id);
  };

  const duplicateLayer = (id: string) => {
    const l = active.layers.find((x) => x.id === id);
    if (!l) return;
    const copy = { ...l, id: `layer_${Math.random().toString(36).slice(2, 7)}`, name: l.name + " copy", x: l.x + 20, y: l.y + 20, z: active.layers.length + 1 };
    updateActive({ ...active, layers: [...active.layers, copy] });
  };

  const deleteLayer = (id: string) => {
    updateActive({ ...active, layers: active.layers.filter((l) => l.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const changeSize = (sizeId: string) => {
    const preset = getPresetById(sizeId);
    const adapted = adaptTemplateToSize(active, preset);
    updateActive(adapted);
  };

  const [showAllSizes, setShowAllSizes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const saveToServer = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSavedId(json.id);
      // keep id in sync
      if (json.id !== active.id) {
        setTemplates((prev) => prev.map((t) => (t.id === active.id ? { ...t, id: json.id } : t)));
        setActiveId(json.id);
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(active, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    // Try server render first if template saved
    if (savedId && product) {
      const handle = product.link.split("/products/")[1]?.split("?")[0];
      if (handle) {
        const url = `/api/render?templateId=${encodeURIComponent(savedId)}&handle=${encodeURIComponent(handle)}&domain=${encodeURIComponent(domain)}`;
        window.open(url, "_blank");
        return;
      }
    }
    const el = exportRef.current;
    if (!el) return;
    const { htmlToPngDataUrl } = await import("@/editor/export");
    try {
      const dataUrl = await htmlToPngDataUrl(el.firstElementChild as HTMLElement);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${active.name}_${product?.id ?? "preview"}.png`;
      a.click();
    } catch (e) {
      alert("PNG export failed (foreignObject CORS). Save to server and use Server PNG. " + String(e));
    }
  };

  const handleAiAssist = () => {
    // For AI agents: copy JSON schema + current template + prompt into clipboard, simulate agent generation
    // MVP: generate a simple variant locally based on prompt keywords
    const p = aiPrompt.toLowerCase();
    let patch: Partial<Template> = {};
    if (p.includes("sale") || p.includes("badge") || p.includes("discount")) {
      const badge: Layer = {
        id: `layer_${Math.random().toString(36).slice(2, 7)}`,
        type: "badge",
        name: "Sale Badge",
        x: 80,
        y: 80,
        w: 220,
        h: 56,
        rotation: -8,
        z: 10,
        visible: true,
        locked: false,
        style: { background: "#dc2626", color: "#fff", fontSize: 28, fontWeight: 800, borderRadius: 12, textAlign: "center", textTransform: "uppercase" },
        content: "{{discount_pct}}% OFF",
      };
      updateActive({ ...active, layers: [...active.layers, badge] });
      setAiPrompt("");
      return;
    }
    if (p.includes("minimal") || p.includes("clean")) {
      patch = { background: "#ffffff", layers: active.layers.map((l) => ({ ...l, style: { ...l.style, background: l.type === "product-image" ? "#ffffff" : l.style.background } })) } as Partial<Template>;
      updateActive(patch as Template);
      setAiPrompt("");
      return;
    }
    if (p.includes("dark") || p.includes("premium")) {
      patch = { background: "#0a0a0a" } as Partial<Template>;
      updateActive(patch as Template);
      // make price badge white on dark
      setTemplates((prev) =>
        prev.map((t) =>
          t.id !== activeId
            ? t
            : {
                ...t,
                background: "#0a0a0a",
                layers: t.layers.map((l) => (l.id === "layer_title" ? { ...l, style: { ...l.style, color: "#fafafa" } } : l)),
              }
        )
      );
      setAiPrompt("");
      return;
    }
    // fallback: copy schema + template to clipboard for real AI agent
    const payload = `You are a CatalogForge AI designer. Edit this Template JSON per instruction.\n\nSCHEMA: ${JSON.stringify(TEMPLATE_JSON_SCHEMA, null, 2)}\n\nTEMPLATE: ${JSON.stringify(active, null, 2)}\n\nINSTRUCTION: ${aiPrompt}\n\nReturn only valid JSON matching schema. Bindings allowed: {{title}}, {{price}}, {{discount_pct}}, {{vendor}}.`;
    navigator.clipboard.writeText(payload);
    alert("Prompt + schema + template copied to clipboard. Paste to your AI agent (ChatGPT/Claude) and paste returned JSON via 'Import JSON'.");
  };

  const importJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as Template;
      // basic validation
      if (!parsed.layers || !parsed.width) throw new Error("Invalid template");
      const withId = { ...parsed, id: active.id, updatedAt: Date.now() };
      setTemplates((prev) => prev.map((t) => (t.id === activeId ? withId : t)));
      setShowJson(false);
    } catch (e) {
      alert("Import failed: " + String(e));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/" className="font-semibold tracking-tight">Catalog Forge</a>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Editor (HTML)</span>
          <a href="/story-map" className="ml-2 text-xs px-2 py-1 border rounded">Story Map</a>
          <a href="/board" className="ml-2 text-xs px-2 py-1 border rounded">Board</a>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-zinc-500">Domain</span>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} className="border rounded px-2 py-1 font-mono text-xs w-44" />
              <button onClick={fetchProducts} disabled={loading} className="px-3 py-1 bg-zinc-900 text-white rounded text-xs disabled:opacity-50">{loading ? "..." : "Load"}</button>
            </div>
            <select value={active.sizeId} onChange={(e) => changeSize(e.target.value)} className="border rounded px-2 py-1 text-xs">
              {SIZE_PRESETS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button onClick={() => setShowAllSizes((v) => !v)} className={`px-2 py-1 border rounded text-xs ${showAllSizes ? "bg-violet-600 text-white" : "bg-white"}`}>{showAllSizes ? "Single" : "All sizes"}</button>
            <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
              <button onClick={() => setScale((s) => Math.max(0.2, s - 0.05))} className="px-1">−</button>
              <span className="font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((s) => Math.min(1, s + 0.05))} className="px-1">+</button>
            </div>
            <button onClick={exportJson} className="hidden sm:inline-flex px-3 py-1.5 border rounded text-xs">Export JSON</button>
            <button onClick={saveToServer} disabled={saving} className="px-3 py-1.5 bg-white border rounded text-xs disabled:opacity-50">{saving ? "Saving…" : savedId ? "Saved ✓" : "Save to Server"}</button>
            <button onClick={handleExportPng} className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs">Export PNG</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left layers */}
        <div className="w-[280px] border-r bg-white hidden lg:flex flex-col shrink-0">
          <LayersPanel
            template={active}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={(t) => updateActive(t)}
            onAdd={addLayer}
            onDelete={deleteLayer}
            onDuplicate={duplicateLayer}
          />
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100">
          {/* AI assist bar */}
          <div className="bg-white border-b px-4 py-2 flex gap-2 items-center">
            <span className="text-xs font-medium shrink-0">AI Assist</span>
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='Try: "add red sale badge" or "make dark premium" or describe any design'
              className="flex-1 border rounded px-3 py-1.5 text-sm"
            />
            <button onClick={handleAiAssist} className="px-3 py-1.5 bg-violet-600 text-white rounded text-xs font-medium">Generate</button>
            <button onClick={() => setShowJson(!showJson)} className="px-3 py-1.5 border rounded text-xs">{showJson ? "Hide JSON" : "Copy JSON"}</button>
          </div>

          {showAllSizes ? (
            <div className="flex-1 overflow-auto p-4 bg-zinc-100">
              <div className="text-xs text-zinc-600 mb-3 flex items-center gap-2">
                <span>Auto-layout preview — same design adapted to every placement. Bottom-anchored title/price stay fixed, product image stretches.</span>
                <button
                  onClick={async () => {
                    for (const preset of SIZE_PRESETS) {
                      const variant = preset.id === active.sizeId ? active : adaptTemplateToSize(active, preset);
                      const toSave = { ...variant, id: `tpl_${Math.random().toString(36).slice(2, 9)}`, name: `${active.name} — ${preset.id}` };
                      await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSave) });
                    }
                    alert("Saved 4 size variants as separate templates. Check Board or list via /api/templates?list=1");
                  }}
                  className="ml-auto text-[11px] px-2 py-1 bg-zinc-900 text-white rounded"
                >
                  Save all 4 variants
                </button>
                <span className="text-[11px] px-2 py-0.5 bg-green-100 border border-green-200 rounded">Active: {active.sizeId} is master</span>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {SIZE_PRESETS.map((preset) => {
                  const variant = preset.id === active.sizeId ? active : adaptTemplateToSize(active, preset);
                  const previewScale = preset.id === "9:16" ? 0.22 : preset.id === "4:5" ? 0.26 : preset.id === "1.91:1" ? 0.24 : 0.28;
                  return (
                    <div key={preset.id} className="bg-white rounded-lg border p-3 flex flex-col items-center">
                      <div className="text-xs font-medium mb-2 flex items-center gap-2">
                        <span>{preset.label}</span>
                        {preset.id === active.sizeId && <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-white rounded">editing</span>}
                      </div>
                      <div className="border bg-zinc-50 overflow-hidden" style={{ width: variant.width * previewScale, height: variant.height * previewScale }}>
                        <TemplateRenderer template={variant} product={product} scale={previewScale} />
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-2">{variant.width}×{variant.height}</div>
                      {savedId && product && (
                        <a href={`/api/render?templateId=${savedId}&handle=${product.link.split("/products/")[1]?.split("?")[0]}&domain=${encodeURIComponent(domain)}`} target="_blank" className="text-[11px] text-blue-600 underline mt-1">PNG</a>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-zinc-500">Tip: Switch the master size via the dropdown — layers keep their distance from bottom (price/badge) and stretch the product image automatically.</div>
            </div>
          ) : (
            <EditorCanvas
              template={active}
              product={product}
              scale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={(t) => updateActive(t)}
            />
          )}

          {/* Hidden export node at 1:1 scale for raster */}
          <div ref={exportRef} className="fixed left-[-9999px] top-0">
            <TemplateRenderer template={active} product={product} scale={1} />
          </div>

          {/* Product strip */}
          <div className="bg-white border-t p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">Preview product</span>
              <span className="text-xs text-zinc-500">{products.length ? `${productIdx + 1} / ${products.length}` : "No products — load store.gibun.at"}</span>
              <div className="ml-auto flex gap-1">
                <button disabled={productIdx === 0} onClick={() => setProductIdx((i) => Math.max(0, i - 1))} className="px-2 py-1 border rounded text-xs disabled:opacity-30">Prev</button>
                <button disabled={productIdx >= products.length - 1} onClick={() => setProductIdx((i) => i + 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-30">Next</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-auto pb-1">
              {products.slice(0, 20).map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => setProductIdx(idx)}
                  className={`shrink-0 w-20 border rounded overflow-hidden bg-white ${idx === productIdx ? "ring-2 ring-blue-500" : ""}`}
                  title={p.title}
                >
                  {p.image_link ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_link} alt="" className="w-full h-20 object-contain bg-zinc-50" />
                  ) : (
                    <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400">No image</div>
                  )}
                  <div className="text-[10px] p-1 truncate text-left">{p.title}</div>
                  <div className="text-[10px] px-1 pb-1 font-mono text-left">{p.price}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right properties */}
        <div className="w-[320px] border-l bg-white hidden xl:block shrink-0 overflow-auto">
          <PropertiesPanel
            template={active}
            selectedId={selectedId}
            onUpdateTemplate={(patch) => updateActive({ ...active, ...patch })}
            onUpdateLayer={updateLayer}
          />
          {showJson && (
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Template JSON (AI-friendly)</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(active, null, 2))}
                  className="text-xs px-2 py-1 border rounded"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={JSON.stringify(active, null, 2)}
                readOnly
                rows={12}
                className="w-full border rounded p-2 font-mono text-[11px] bg-zinc-50"
              />
              <div className="text-[11px] text-zinc-500">Agents: edit this JSON and paste below to import. Bindings: {`{{title}} {{price}} {{discount_pct}} {{vendor}}`}</div>
              <textarea
                placeholder="Paste AI-returned JSON here then press Import"
                rows={4}
                className="w-full border rounded p-2 font-mono text-xs"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") importJson((e.target as HTMLTextAreaElement).value);
                }}
                id="import-json"
              />
              <button onClick={() => importJson((document.getElementById("import-json") as HTMLTextAreaElement)?.value ?? "")} className="w-full py-1.5 bg-zinc-900 text-white rounded text-xs">Import JSON</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile layers/properties drawers */}
      <div className="lg:hidden border-t bg-white p-3 flex gap-2 overflow-auto text-xs">
        <span className="font-medium">Tip:</span> Open on desktop for full layers + properties. Mobile supports drag + AI prompts.
      </div>

      {/* Enriched feed bar — shown when saved */}
      {savedId && (
        <div className="bg-violet-50 border-t border-violet-200 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-violet-900">Enriched Feed (server raster)</span>
            <span className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-full">Saved: {savedId}</span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/api/feed?domain=${encodeURIComponent(domain)}&templateId=${encodeURIComponent(savedId)}`;
                navigator.clipboard.writeText(url);
                alert("Enriched feed URL copied");
              }}
              className="ml-auto text-xs px-3 py-1 bg-violet-600 text-white rounded"
            >
              Copy Enriched Feed URL
            </button>
            <a
              href={`/api/feed?domain=${encodeURIComponent(domain)}&templateId=${encodeURIComponent(savedId)}`}
              target="_blank"
              className="text-xs px-3 py-1 border bg-white rounded"
            >
              Download CSV
            </a>
          </div>
          <code className="block text-xs font-mono bg-white border rounded px-3 py-2 break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/feed?domain=${domain}&templateId=${savedId}`}</code>
          <div className="text-[11px] text-violet-700">image_link now points to <code className="bg-white px-1 rounded">/api/render?templateId={savedId}&handle=...</code> — Meta will fetch PNGs rendered via next/og. Try one: {product && <a href={`/api/render?templateId=${savedId}&handle=${product.link.split("/products/")[1]?.split("?")[0]}&domain=${encodeURIComponent(domain)}`} target="_blank" className="underline">preview current product PNG</a>}</div>
        </div>
      )}

      {/* Size + feed preview bar */}
      <div className="bg-white border-t px-4 py-3 flex items-center gap-4">
        <div className="text-xs text-zinc-600">HTML templates double as ad creatives — no canvas lib. {savedId ? "Saved to server — use Enriched Feed above." : "Save to Server to enable enriched feed (image_link → /api/render)."}</div>
        <div className="ml-auto flex gap-2">
          <div className="hidden sm:flex items-center gap-2">
            {SIZE_PRESETS.map((s) => (
              <button key={s.id} onClick={() => changeSize(s.id)} className={`px-2 py-1 rounded text-xs border ${active.sizeId === s.id ? "bg-zinc-900 text-white" : "bg-white"}`}>{s.id}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:inline">Live templates: {templates.length}</span>
            <button
              onClick={() => {
                const t = createDefaultTemplate(active.sizeId);
                setTemplates((p) => [...p, t]);
                setActiveId(t.id);
              }}
              className="px-3 py-1 border rounded text-xs"
            >
              New Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
