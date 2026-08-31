"use client";

import type { Layer, Template } from "./types";

export function LayersPanel({
  template,
  selectedId,
  onSelect,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
}: {
  template: Template;
  selectedId: string | null;
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
    // reassign z based on order
    const withZ = next.map((l, i) => ({ ...l, z: i + 1 }));
    onUpdate({ ...template, layers: withZ, updatedAt: Date.now() });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium">Layers</h3>
        <div className="flex gap-1">
          <button onClick={() => onAdd("text")} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded">+ Text</button>
          <button onClick={() => onAdd("badge")} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded">+ Badge</button>
          <button onClick={() => onAdd("shape")} className="text-xs px-2 py-1 border rounded">+ Shape</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto divide-y">
        {[...template.layers]
          .slice()
          .sort((a, b) => b.z - a.z)
          .map((l) => (
            <div
              key={l.id}
              onClick={() => onSelect(l.id)}
              className={`px-3 py-2 flex items-center gap-2 cursor-pointer text-sm ${selectedId === l.id ? "bg-blue-50" : "hover:bg-zinc-50"}`}
            >
              <span className="text-xs w-6 h-6 rounded bg-zinc-100 flex items-center justify-center shrink-0">
                {l.type === "product-image" ? "🖼" : l.type === "text" ? "T" : l.type === "badge" ? "⬢" : "▭"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-xs">{l.name}</div>
                <div className="truncate text-[11px] text-zinc-500">{l.type} • {l.content?.slice(0, 24) ?? "—"}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({
                      ...template,
                      layers: template.layers.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)),
                    });
                  }}
                  className={`text-xs px-1 ${l.visible ? "" : "opacity-30"}`}
                  title="Toggle visibility"
                >
                  {l.visible ? "👁" : "🚫"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} className="text-xs px-1" title="Bring forward">↑</button>
                <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} className="text-xs px-1" title="Send back">↓</button>
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(l.id); }} className="text-xs px-1" title="Duplicate">⎘</button>
                {l.type !== "product-image" && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(l.id); }} className="text-xs px-1 text-red-600" title="Delete">×</button>
                )}
              </div>
            </div>
          ))}
      </div>
      <div className="p-3 border-t space-y-2">
        <div className="text-xs text-zinc-500">Template: {template.width}×{template.height} • {template.sizeId}</div>
        <div className="text-[11px] text-zinc-400">Tip: Drag on canvas to move, handles to resize. Bindings like {`{{price}}`} update per product.</div>
      </div>
    </div>
  );
}
