"use client";

import { useState } from "react";
import type { Layer, Template } from "./types";
import { BINDINGS } from "./types";
import { fontFallbackNotice } from "./renderStyles";

const LINE = "#e9e4d6";

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`w-4 h-4 text-zinc-500 transition-transform ${collapsed ? "rotate-180" : ""}`}
    >
      <path d="m4 10 4-4 4 4" />
    </svg>
  );
}

function Section({
  title,
  hint,
  children,
  collapsed,
  onToggle,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (!onToggle) {
    return (
      <div className="py-5 first:pt-2">
        <div className="text-[13px] font-semibold text-zinc-900">{title}</div>
        {hint ? <div className="text-[11px] text-zinc-500 mt-0.5 mb-3">{hint}</div> : <div className="mb-3" />}
        {children}
      </div>
    );
  }
  const isCollapsed = collapsed ?? false;
  return (
    <div className="py-5 first:pt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="flex w-full items-center justify-between min-h-[40px] text-left"
      >
        <span className="text-[13px] font-semibold text-zinc-900">{title}</span>
        <span className="flex items-center justify-center min-w-[40px] min-h-[40px] shrink-0">
          <Chevron collapsed={isCollapsed} />
        </span>
      </button>
      {!isCollapsed && (
        <>
          {hint ? <div className="text-[11px] text-zinc-500 mt-0.5 mb-3">{hint}</div> : <div className="mb-3" />}
          {children}
        </>
      )}
    </div>
  );
}

function isHex(v: string | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function PropertiesPanel({
  template,
  selectedId,
  onUpdateTemplate,
  onUpdateLayer,
}: {
  template: Template;
  selectedId: string | null;
  onUpdateTemplate: (patch: Partial<Template>) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer> | ((l: Layer) => Partial<Layer>)) => void;
}) {
  const layer = template.layers.find((l) => l.id === selectedId) ?? null;
  const fontNotice = layer ? fontFallbackNotice(layer.style.fontFamily) : null;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!layer) {
    return (
      <div className="p-4 space-y-2" style={{ background: "#fdfcf8" }}>
        <div className="text-[15px] font-semibold">Template</div>
        <div className="text-[11px] text-zinc-500">No layer selected</div>
        <Section title="Template">
          <label className="block text-xs">
            <span className="text-zinc-600">Name</span>
            <input
              value={template.name}
              onChange={(e) => onUpdateTemplate({ name: e.target.value })}
              className="mt-1 w-full border rounded-xl px-2.5 py-1.5 text-sm bg-white"
              style={{ borderColor: LINE }}
            />
          </label>
          <label className="block text-xs mt-3">
            <span className="text-zinc-600">Background</span>
            <div className="flex gap-2 mt-1">
              <input
                type="color"
                value={template.background.startsWith("#") ? template.background : "#ffffff"}
                onChange={(e) => onUpdateTemplate({ background: e.target.value })}
                className="w-9 h-9 p-0.5 border rounded-xl bg-white"
                style={{ borderColor: LINE }}
              />
              <input
                value={template.background}
                onChange={(e) => onUpdateTemplate({ background: e.target.value })}
                className="flex-1 border rounded-xl px-2.5 py-1.5 text-sm font-mono bg-white"
                style={{ borderColor: LINE }}
                placeholder="#ffffff or gradient"
              />
            </div>
          </label>
        </Section>
        <div className="text-xs text-zinc-500 p-3 rounded-2xl border" style={{ borderColor: LINE, background: "#f6f2e8" }}>
          Select a layer to edit content, position and style. Press <span className="font-mono border rounded px-1 bg-white">⌘J</span> for AI, <span className="font-mono border rounded px-1 bg-white">⌘S</span> to save.
        </div>
      </div>
    );
  }

  const updateStyle = (patch: Partial<Layer["style"]>) => onUpdateLayer(layer.id, (l) => ({ style: { ...l.style, ...patch } }));
  const bg = layer.style.background ?? "";
  const fg = layer.style.color ?? "";
  const isText = layer.type === "text" || layer.type === "badge";

  return (
    <div className="px-5 py-2 overflow-auto divide-y divide-[#e9e4d6]" style={{ background: "#fdfcf8" }}>
      <button
        type="button"
        onClick={() => setPanelCollapsed((v) => !v)}
        aria-expanded={!panelCollapsed}
        className="flex w-full items-center justify-between gap-2 py-4 min-h-[40px] text-left"
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold truncate">{layer.name}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{layer.type}</div>
        </div>
        <span className="flex items-center justify-center min-w-[40px] min-h-[40px] shrink-0">
          <Chevron collapsed={panelCollapsed} />
        </span>
      </button>

      {!panelCollapsed && (
        <>
      {/* ——— Content ——— */}
      <Section title="Content" collapsed={collapsed.content ?? false} onToggle={() => toggle("content")}>
        <label className="block text-xs">
          <span className="text-zinc-600">Layer name</span>
          <input
            value={layer.name}
            onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
            className="mt-1 w-full border rounded-xl px-2.5 py-1.5 text-sm bg-white"
            style={{ borderColor: LINE }}
          />
        </label>
        {isText && (
          <label className="block text-xs mt-3">
            <span className="text-zinc-600">Text <span className="font-mono text-zinc-400">{"{{binding}}"}</span></span>
            <textarea
              value={layer.content ?? ""}
              onChange={(e) => onUpdateLayer(layer.id, { content: e.target.value })}
              rows={2}
              className="mt-1 w-full border rounded-xl px-2.5 py-1.5 text-sm font-mono bg-white"
              style={{ borderColor: LINE }}
              placeholder="{{title}} or {{price}} or 20% OFF"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {BINDINGS.slice(0, 6).map((b) => (
                <button
                  key={b.key}
                  onClick={() => onUpdateLayer(layer.id, { content: (layer.content ?? "") + `{{${b.key}}}` })}
                  className="text-[11px] font-mono px-2 py-1 rounded-[10px] border bg-white hover:border-zinc-500"
                  style={{ borderColor: LINE }}
                  title={b.example}
                >
                  {`{{${b.key}}}`}
                </button>
              ))}
            </div>
          </label>
        )}
        {layer.type === "product-image" && (
          <div className="mt-3">
            <span className="text-xs text-zinc-600">Image / Fit</span>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border p-1 bg-white" style={{ borderColor: LINE }}>
              {(["contain", "cover"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onUpdateLayer(layer.id, { objectFit: v })}
                  className={`min-h-[40px] px-2 rounded-[10px] text-xs font-medium ${ (layer.objectFit ?? "cover") === v ? "text-white" : "text-zinc-500"}`}
                  style={(layer.objectFit ?? "cover") === v ? { background: "#191712" } : undefined}
                >
                  {v === "contain" ? "Contain" : "Cover (crop)"}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ——— Position & Size ——— */}
      <Section title="Position & Size" collapsed={collapsed.position ?? false} onToggle={() => toggle("position")}>
        <div className="grid grid-cols-2 gap-1.5 font-mono">
          {([["X", layer.x, (v: number) => ({ x: v })], ["Y", layer.y, (v: number) => ({ y: v })], ["W", layer.w, (v: number) => ({ w: Math.max(40, v) })], ["H", layer.h, (v: number) => ({ h: Math.max(40, v) })]] as const).map(([k, val, toPatch]) => (
            <label key={k} className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 bg-white text-[12px]" style={{ borderColor: LINE }}>
              <span className="text-zinc-400 text-[11px]">{k}</span>
              <input
                type="number"
                value={val}
                onChange={(e) => onUpdateLayer(layer.id, toPatch(parseInt(e.target.value) || 0))}
                className="w-full outline-none bg-transparent"
              />
            </label>
          ))}
        </div>
        <div className="text-[11px] text-zinc-400 mt-2">Tip: drag on canvas to move, corners to resize.</div>
      </Section>

      {/* ——— Style ——— */}
      <Section title="Style" collapsed={collapsed.style ?? false} onToggle={() => toggle("style")}>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-zinc-600">Background</span>
            <div className="flex gap-2 mt-1">
              {isHex(bg) ? (
                <input type="color" value={bg} onChange={(e) => updateStyle({ background: e.target.value })} className="w-9 h-9 p-0.5 border rounded-xl bg-white shrink-0" style={{ borderColor: LINE }} />
              ) : (
                <span className="w-9 h-9 rounded-xl border flex items-center justify-center text-[10px] text-zinc-400 shrink-0" style={{ borderColor: LINE }}>—</span>
              )}
              <input value={bg} onChange={(e) => updateStyle({ background: e.target.value })} placeholder="transparent, #111" className="flex-1 min-w-0 border rounded-xl px-2.5 py-1.5 text-[12px] font-mono bg-white" style={{ borderColor: LINE }} />
            </div>
          </label>
          {isText && (
            <label className="block text-xs">
              <span className="text-zinc-600">Text color</span>
              <div className="flex gap-2 mt-1">
                {isHex(fg) ? (
                  <input type="color" value={fg} onChange={(e) => updateStyle({ color: e.target.value })} className="w-9 h-9 p-0.5 border rounded-xl bg-white shrink-0" style={{ borderColor: LINE }} />
                ) : (
                  <span className="w-9 h-9 rounded-xl border flex items-center justify-center text-[10px] text-zinc-400 shrink-0" style={{ borderColor: LINE }}>A</span>
                )}
                <input value={fg} onChange={(e) => updateStyle({ color: e.target.value })} placeholder="#111, #fff" className="flex-1 min-w-0 border rounded-xl px-2.5 py-1.5 text-[12px] font-mono bg-white" style={{ borderColor: LINE }} />
              </div>
            </label>
          )}
          {isText && (
            <>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-zinc-600">Size</span><span className="font-mono">{layer.style.fontSize ?? 32}px</span></div>
                <input type="range" min={12} max={120} value={layer.style.fontSize ?? 32} onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })} className="w-full accent-[#3a5a1e]" />
              </div>
              <div>
                <span className="text-xs text-zinc-600">Weight</span>
                <div className="mt-1 grid grid-cols-4 gap-1 rounded-xl border p-1 bg-white" style={{ borderColor: LINE }}>
                  {[400, 600, 700, 800].map((w) => (
                    <button key={w} onClick={() => updateStyle({ fontWeight: w })} className={`min-h-[40px] px-1 rounded-[10px] font-mono text-[11px] ${(layer.style.fontWeight ?? 600) === w ? "text-white" : "text-zinc-500"}`} style={(layer.style.fontWeight ?? 600) === w ? { background: "#191712" } : undefined}>{w}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="text-zinc-600">Align</span>
                  <select value={layer.style.textAlign ?? "center"} onChange={(e) => updateStyle({ textAlign: e.target.value as Layer["style"]["textAlign"] })} className="mt-1 w-full border rounded-xl px-2 py-1.5 text-[12px] bg-white" style={{ borderColor: LINE }}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-zinc-600">Case</span>
                  <select value={layer.style.textTransform ?? "none"} onChange={(e) => updateStyle({ textTransform: e.target.value as Layer["style"]["textTransform"] })} className="mt-1 w-full border rounded-xl px-2 py-1.5 text-[12px] bg-white" style={{ borderColor: LINE }}>
                    <option value="none">None</option>
                    <option value="uppercase">UPPER</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-zinc-600">Radius</span><span className="font-mono">{layer.style.borderRadius ?? 0}</span></div>
              <input type="range" min={0} max={200} value={layer.style.borderRadius ?? 0} onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) })} className="w-full accent-[#3a5a1e]" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-zinc-600">Opacity</span><span className="font-mono">{Math.round((layer.style.opacity ?? 1) * 100)}%</span></div>
              <input type="range" min={0} max={1} step={0.05} value={layer.style.opacity ?? 1} onChange={(e) => updateStyle({ opacity: parseFloat(e.target.value) })} className="w-full accent-[#3a5a1e]" />
            </div>
          </div>
          {fontNotice ? <p className="text-[11px] text-amber-700">{fontNotice}</p> : null}
        </div>
      </Section>

      <Section title="Layer" collapsed={collapsed.layer ?? false} onToggle={() => toggle("layer")}>
        <div className="flex gap-1.5">
          <button
            onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
            className={`flex-1 min-h-[40px] px-2 rounded-xl border text-xs font-medium ${layer.visible ? "bg-white" : "bg-zinc-100 text-zinc-400"}`}
            style={{ borderColor: LINE }}
          >
            {layer.visible ? "◉ Visible" : "○ Hidden"}
          </button>
          <button
            onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
            className={`flex-1 min-h-[40px] px-2 rounded-xl border text-xs font-medium ${layer.locked ? "text-white" : "bg-white"}`}
            style={layer.locked ? { background: "#191712", borderColor: "#191712" } : { borderColor: LINE }}
          >
            {layer.locked ? "🔒 Locked" : "🔓 Unlocked"}
          </button>
        </div>
      </Section>
        </>
      )}
    </div>
  );
}
