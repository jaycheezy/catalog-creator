"use client";

import type { Layer, Template } from "./types";
import { BINDINGS } from "./types";

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

  if (!layer) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-medium">Template</h3>
        <label className="block text-xs">
          <span className="text-zinc-600">Name</span>
          <input
            value={template.name}
            onChange={(e) => onUpdateTemplate({ name: e.target.value })}
            className="mt-1 w-full border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-600">Background</span>
          <div className="flex gap-2 mt-1">
            <input type="color" value={template.background.startsWith("#") ? template.background : "#ffffff"} onChange={(e) => onUpdateTemplate({ background: e.target.value })} className="w-8 h-8 p-0 border rounded" />
            <input value={template.background} onChange={(e) => onUpdateTemplate({ background: e.target.value })} className="flex-1 border rounded px-2 py-1 text-sm font-mono" placeholder="#ffffff or gradient" />
          </div>
        </label>
        <div className="text-xs text-zinc-500 p-3 bg-zinc-50 rounded">Select a layer to edit its position, size, style and bindings. AI agents edit this JSON directly — see “Copy JSON”.</div>
      </div>
    );
  }

  const updateStyle = (patch: Partial<Layer["style"]>) => onUpdateLayer(layer.id, (l) => ({ style: { ...l.style, ...patch } }));

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Layer: {layer.name}</h3>
        <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded">{layer.type}</span>
      </div>

      <label className="block text-xs">
        <span className="text-zinc-600">Name</span>
        <input
          value={layer.name}
          onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
        />
      </label>

      {(layer.type === "text" || layer.type === "badge") && (
        <label className="block text-xs">
          <span className="text-zinc-600">Content (use {`{{binding}}`})</span>
          <textarea
            value={layer.content ?? ""}
            onChange={(e) => onUpdateLayer(layer.id, { content: e.target.value })}
            rows={2}
            className="mt-1 w-full border rounded px-2 py-1 text-sm font-mono"
            placeholder="{{title}} or {{price}} or 20% OFF"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {BINDINGS.slice(0, 6).map((b) => (
              <button
                key={b.key}
                onClick={() => onUpdateLayer(layer.id, { content: (layer.content ?? "") + `{{${b.key}}}` })}
                className="text-[11px] px-1.5 py-0.5 bg-zinc-100 hover:bg-zinc-200 rounded border"
                title={b.example}
              >
                {`{{${b.key}}}`}
              </button>
            ))}
          </div>
        </label>
      )}

      {layer.type === "product-image" && (
        <label className="block text-xs">
          <span className="text-zinc-600">Object Fit</span>
          <select value={layer.objectFit ?? "contain"} onChange={(e) => onUpdateLayer(layer.id, { objectFit: e.target.value as Layer["objectFit"] })} className="mt-1 w-full border rounded px-2 py-1 text-sm">
            <option value="contain">Contain</option>
            <option value="cover">Cover (crop)</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="text-zinc-600">X</span>
          <input type="number" value={layer.x} onChange={(e) => onUpdateLayer(layer.id, { x: parseInt(e.target.value) || 0 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">Y</span>
          <input type="number" value={layer.y} onChange={(e) => onUpdateLayer(layer.id, { y: parseInt(e.target.value) || 0 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">W</span>
          <input type="number" value={layer.w} onChange={(e) => onUpdateLayer(layer.id, { w: parseInt(e.target.value) || 40 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">H</span>
          <input type="number" value={layer.h} onChange={(e) => onUpdateLayer(layer.id, { h: parseInt(e.target.value) || 40 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-zinc-700">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="text-zinc-600">Background</span>
            <input value={layer.style.background ?? ""} onChange={(e) => updateStyle({ background: e.target.value })} placeholder="transparent, #111" className="mt-1 w-full border rounded px-2 py-1 text-sm font-mono" />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Text Color</span>
            <input value={layer.style.color ?? ""} onChange={(e) => updateStyle({ color: e.target.value })} placeholder="#111, #fff" className="mt-1 w-full border rounded px-2 py-1 text-sm font-mono" />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Font Size</span>
            <input type="number" value={layer.style.fontSize ?? 32} onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) || 12 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Weight</span>
            <select value={layer.style.fontWeight ?? 600} onChange={(e) => updateStyle({ fontWeight: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm">
              <option value={400}>400 Normal</option>
              <option value={600}>600 Semibold</option>
              <option value={700}>700 Bold</option>
              <option value={800}>800 ExtraBold</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Radius</span>
            <input type="number" value={layer.style.borderRadius ?? 0} onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) || 0 })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Opacity</span>
            <input type="number" min={0} max={1} step={0.05} value={layer.style.opacity ?? 1} onChange={(e) => updateStyle({ opacity: parseFloat(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="text-zinc-600">Align</span>
            <select value={layer.style.textAlign ?? "center"} onChange={(e) => updateStyle({ textAlign: e.target.value as Layer["style"]["textAlign"] })} className="mt-1 w-full border rounded px-2 py-1 text-sm">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="text-zinc-600">Transform</span>
            <select value={layer.style.textTransform ?? "none"} onChange={(e) => updateStyle({ textTransform: e.target.value as Layer["style"]["textTransform"] })} className="mt-1 w-full border rounded px-2 py-1 text-sm">
              <option value="none">None</option>
              <option value="uppercase">Uppercase</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={!!layer.visible} onChange={(e) => onUpdateLayer(layer.id, { visible: e.target.checked })} /> Visible
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={!!layer.locked} onChange={(e) => onUpdateLayer(layer.id, { locked: e.target.checked })} /> Locked
        </label>
      </div>
    </div>
  );
}
