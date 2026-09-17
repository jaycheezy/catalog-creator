"use client";

import type { Layer, Template } from "./types";

const LINE = "#e9e4d6";
const MOSS = "#3a5a1e";

function LayerGlyph({ type }: { type: Layer["type"] }) {
  const common = "w-4 h-4";
  if (type === "product-image") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5.5" cy="6.5" r="1.25" fill="currentColor" />
        <path d="M3 12.5l3.2-3.2 2.3 2.3 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "badge") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <path d="M2.5 2.5h5.2L13.5 8l-5.5 5.5-5.5-5.5V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="6" cy="6" r="1.25" fill="currentColor" />
      </svg>
    );
  }
  if (type === "shape") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" className="text-[13px] font-bold leading-none">
      T
    </span>
  );
}

export function LayersPanel({
  template,
  selectedId,
  highlightedIds = [],
  onSelect,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
}: {
  template: Template;
  selectedId: string | null;
  highlightedIds?: string[];
  onSelect: (id: string) => void;
  onUpdate: (patch: Template) => void;
  onAdd: (type: Layer["type"]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const move = (id: string, dir: -1 | 1) => {
    const idx = template.layers.findIndex((l) => l.id === id);
    const next = [...template.layers];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= next.length) return;
    const [item] = next.splice(idx, 1);
    next.splice(newIdx, 0, item);
    const withZ = next.map((l, i) => ({ ...l, z: i + 1 }));
    onUpdate({ ...template, layers: withZ, updatedAt: Date.now() });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#fdfcf8" }}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h3 className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">LAYERS — {template.layers.length}</h3>
        <span className="font-mono text-[10px] text-zinc-400">{template.width}×{template.height}</span>
      </div>
      <div className="flex-1 overflow-auto px-2.5 pb-2 space-y-2">
        {[...template.layers]
          .slice()
          .sort((a, b) => b.z - a.z)
          .map((l) => {
            const highlighted = highlightedIds.includes(l.id);
            const selected = selectedId === l.id;
            return (
              <div
                key={l.id}
                onClick={() => onSelect(l.id)}
                className={`px-2.5 pt-2 pb-2 rounded-2xl border bg-white cursor-pointer hover:border-zinc-400 transition-colors ${highlighted ? "ring-1 ring-inset ring-violet-300" : ""}`}
                style={{ borderColor: selected ? MOSS : highlighted ? "#a78bfa" : LINE, background: selected ? "#f3f6ec" : "#fff", boxShadow: selected ? "0 4px 14px -8px rgba(58,90,30,0.5)" : undefined }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                    style={{ background: selected ? MOSS : "#c9bfa8" }}
                  >
                    <LayerGlyph type={l.type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold text-[13px] leading-tight">
                      {l.name}
                      {highlighted && <span className="ml-1.5 text-[10px] font-normal text-violet-700">Changed by agent</span>}
                    </div>
                    <div className="truncate text-[11px] font-mono text-zinc-500">{l.type} • {l.content?.slice(0, 22) ?? "—"}</div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onUpdate({ ...template, layers: template.layers.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)) })}
                      className={`w-10 h-10 min-w-10 min-h-10 rounded-[10px] text-[14px] flex items-center justify-center hover:bg-zinc-100 ${l.visible ? "" : "opacity-30"}`}
                      title={l.visible ? "Hide layer" : "Show layer"}
                      aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
                      aria-pressed={l.visible}
                    >
                      {l.visible ? (
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                          <path d="M3 3l10 10M6.6 4.1C7 4 7.5 4 8 4c4 0 6.5 4 6.5 4a12.6 12.6 0 01-2.4 2.7M9.9 9.9A2.5 2.5 0 016 6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M4 5.5C2.6 6.7 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1 0 1.9-.3 2.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => move(l.id, 1)} className="flex-1 min-h-10 min-w-10 px-2 rounded-[10px] border text-[12px] font-medium bg-white hover:bg-zinc-50 flex items-center justify-center gap-1" style={{ borderColor: LINE }} title="Bring forward" aria-label={`Bring ${l.name} forward`}>↑ <span>Up</span></button>
                  <button onClick={() => move(l.id, -1)} className="flex-1 min-h-10 min-w-10 px-2 rounded-[10px] border text-[12px] font-medium bg-white hover:bg-zinc-50 flex items-center justify-center gap-1" style={{ borderColor: LINE }} title="Send back" aria-label={`Send ${l.name} back`}>↓ <span>Down</span></button>
                  <button onClick={() => onDuplicate(l.id)} className="flex-1 min-h-10 min-w-10 px-2 rounded-[10px] border text-[12px] font-medium bg-white hover:bg-zinc-50 flex items-center justify-center gap-1" style={{ borderColor: LINE }} title="Duplicate" aria-label={`Duplicate ${l.name}`}>⧉ <span>Copy</span></button>
                  {l.type !== "product-image" && (
                    <button onClick={() => onDelete(l.id)} className="flex-1 min-h-10 min-w-10 px-2 rounded-[10px] border text-[12px] font-medium bg-white text-red-600 hover:bg-red-50 flex items-center justify-center gap-1" style={{ borderColor: LINE }} title="Delete" aria-label={`Delete ${l.name}`}>× <span>Delete</span></button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <div className="p-2.5">
        <div className="rounded-2xl border p-3 text-center bg-white" style={{ borderColor: LINE }}>
          <div className="text-[13px] font-semibold">Add something</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Pick one to add it to your design</div>
          <div className="flex gap-1.5 mt-2.5">
            <button onClick={() => onAdd("text")} className="flex-1 min-h-10 px-2 rounded-[10px] bg-white border text-[12px] font-medium hover:border-zinc-500 flex items-center justify-center" style={{ borderColor: LINE }}>+ Text</button>
            <button onClick={() => onAdd("badge")} className="flex-1 min-h-10 px-2 rounded-[10px] text-white text-[12px] font-semibold flex items-center justify-center" style={{ background: MOSS }}>+ Badge</button>
            <button onClick={() => onAdd("shape")} className="flex-1 min-h-10 px-2 rounded-[10px] bg-white border text-[12px] font-medium hover:border-zinc-500 flex items-center justify-center" style={{ borderColor: LINE }}>+ Shape</button>
          </div>
        </div>
        <div className="text-[11px] text-zinc-400 mt-2 px-1">Drag on canvas to move · {"{{price}}"} updates per product</div>
      </div>
    </div>
  );
}
