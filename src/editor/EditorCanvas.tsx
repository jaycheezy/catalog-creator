"use client";

import { useRef, useState } from "react";
import type { Template, Layer } from "./types";
import { TemplateRenderer } from "./TemplateRenderer";
import type { FeedRow } from "@/lib/facebook";

export function EditorCanvas({
  template,
  product,
  scale,
  selectedId,
  onSelect,
  onUpdate,
}: {
  template: Template;
  product: FeedRow | null;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (patch: Template) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { id: string; startX: number; startY: number; origX: number; origY: number }>(null);
  const [resize, setResize] = useState<null | { id: string; handle: string; startX: number; startY: number; orig: Layer }>(null);

  const selected = template.layers.find((l) => l.id === selectedId) ?? null;

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).dataset.handle) {
      const handle = (e.target as HTMLElement).dataset.handle!;
      const orig = template.layers.find((l) => l.id === id)!;
      setResize({ id, handle, startX: e.clientX, startY: e.clientY, orig: { ...orig } });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const layer = template.layers.find((l) => l.id === id);
    if (!layer || layer.locked) return;
    onSelect(id);
    setDrag({ id, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      const next = template.layers.map((l) => (l.id === drag.id ? { ...l, x: Math.round(drag.origX + dx), y: Math.round(drag.origY + dy) } : l));
      onUpdate({ ...template, layers: next, updatedAt: Date.now() });
    }
    if (resize) {
      const dx = (e.clientX - resize.startX) / scale;
      const dy = (e.clientY - resize.startY) / scale;
      const { orig, handle, id } = resize;
      let { x, y, w, h } = orig;
      if (handle.includes("e")) w = Math.max(40, orig.w + dx);
      if (handle.includes("s")) h = Math.max(40, orig.h + dy);
      if (handle.includes("w")) {
        const newW = Math.max(40, orig.w - dx);
        x = orig.x + orig.w - newW;
        w = newW;
      }
      if (handle.includes("n")) {
        const newH = Math.max(40, orig.h - dy);
        y = orig.y + orig.h - newH;
        h = newH;
      }
      const next = template.layers.map((l) => (l.id === id ? { ...l, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : l));
      onUpdate({ ...template, layers: next, updatedAt: Date.now() });
    }
  };

  const handlePointerUp = () => {
    setDrag(null);
    setResize(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-zinc-200 flex items-center justify-center overflow-auto p-8"
      style={{ minHeight: 520 }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div className="bg-white shadow-xl" style={{ width: template.width * scale, height: template.height * scale }}>
        {/* Intercept layer pointer events via overlay divs for drag/resize */}
        <div className="relative" style={{ width: template.width * scale, height: template.height * scale }}>
          <TemplateRenderer template={template} product={product} scale={scale} interactive={false} selectedId={selectedId} />

          {/* Hit areas for drag/resize */}
          {template.layers
            .filter((l) => l.visible)
            .map((layer) => (
              <div
                key={layer.id + "-hit"}
                onPointerDown={(e) => handlePointerDown(e, layer.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(layer.id);
                }}
                style={{
                  position: "absolute",
                  left: layer.x * scale,
                  top: layer.y * scale,
                  width: layer.w * scale,
                  height: layer.h * scale,
                  cursor: layer.locked ? "not-allowed" : "move",
                  // transparent hit area
                  background: "transparent",
                  border: selectedId === layer.id ? "2px solid #3b82f6" : "1px solid transparent",
                  zIndex: layer.z + 100,
                }}
              >
                {selectedId === layer.id && !layer.locked && (
                  <>
                    <div data-handle="nw" className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm" style={{ left: -6, top: -6, cursor: "nw-resize" }} />
                    <div data-handle="ne" className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm" style={{ right: -6, top: -6, cursor: "ne-resize" }} />
                    <div data-handle="sw" className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm" style={{ left: -6, bottom: -6, cursor: "sw-resize" }} />
                    <div data-handle="se" className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm" style={{ right: -6, bottom: -6, cursor: "se-resize" }} />
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
