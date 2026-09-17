"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Template, Layer } from "./types";
import { TemplateRenderer } from "./TemplateRenderer";
import type { FeedRow } from "@/lib/facebook";

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const DOT_SIZE = 24;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function EditorCanvas({
  template,
  product,
  scale,
  selectedId,
  onSelect,
  onUpdate,
  onScaleChange,
}: {
  template: Template;
  product: FeedRow | null;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (patch: Template) => void;
  onScaleChange?: (scale: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  // Pan offset in screen px from the centered position. {0,0} = canvas centered.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState<null | { startX: number; startY: number; origX: number; origY: number; moved: boolean }>(null);
  const [drag, setDrag] = useState<null | { id: string; startX: number; startY: number; origX: number; origY: number }>(null);
  const [resize, setResize] = useState<null | { id: string; handle: string; startX: number; startY: number; orig: Layer }>(null);
  const spaceRef = useRef(false);

  const setScale = useCallback(
    (next: number) => onScaleChange?.(clampScale(next)),
    [onScaleChange],
  );

  // Track viewport size for centering + fit.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewport({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Space held => temporary pan tool (cursor + drag anywhere pans).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        spaceRef.current = true;
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const canvasW = template.width * scale;
  const canvasH = template.height * scale;
  const canvasLeft = viewport.w / 2 + pan.x - canvasW / 2;
  const canvasTop = viewport.h / 2 + pan.y - canvasH / 2;

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const el = viewportRef.current;
      if (!el || !onScaleChange) return;
      const rect = el.getBoundingClientRect();
      const clamped = clampScale(nextScale);
      if (clamped === scale) return;
      // Template-space point under the cursor stays pinned.
      const left = viewport.w / 2 + pan.x - (template.width * scale) / 2;
      const top = viewport.h / 2 + pan.y - (template.height * scale) / 2;
      const tx = (clientX - rect.left - left) / scale;
      const ty = (clientY - rect.top - top) / scale;
      const newW = template.width * clamped;
      const newH = template.height * clamped;
      setPan({
        x: clientX - rect.left - tx * clamped - viewport.w / 2 + newW / 2,
        y: clientY - rect.top - ty * clamped - viewport.h / 2 + newH / 2,
      });
      onScaleChange(clamped);
    },
    [onScaleChange, pan.x, pan.y, scale, template.height, template.width, viewport.h, viewport.w],
  );

  const fitToView = useCallback(() => {
    const pad = 96;
    const fit = Math.min((viewport.w - pad) / template.width, (viewport.h - pad) / template.height);
    setPan({ x: 0, y: 0 });
    setScale(Number.isFinite(fit) ? fit : 0.42);
  }, [setScale, template.height, template.width, viewport.h, viewport.w]);

  // Wheel: plain wheel pans, Ctrl/Cmd+wheel (pinch) zooms to cursor. True canvas feel.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.01);
        zoomAtPoint(e.clientX, e.clientY, scale * factor);
      } else {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale, zoomAtPoint]);

  const handleLayerPointerDown = (e: React.PointerEvent, id: string) => {
    // Middle-mouse or space+drag anywhere pans, even starting on a layer.
    if (e.button === 1 || spaceRef.current) {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, moved: false });
      return;
    }
    if ((e.target as HTMLElement).dataset.handle) {
      const handle = (e.target as HTMLElement).dataset.handle!;
      const orig = template.layers.find((l) => l.id === id)!;
      setResize({ id, handle, startX: e.clientX, startY: e.clientY, orig: { ...orig } });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const layer = template.layers.find((l) => l.id === id);
    if (!layer || layer.locked) return;
    e.stopPropagation();
    onSelect(id);
    setDrag({ id, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) e.preventDefault();
    // Only background starts a pan (layers stopPropagation above).
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, moved: false });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        setPanning({ ...panning, moved: true });
        setPan({ x: panning.origX + dx, y: panning.origY + dy });
      }
      return;
    }
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
    if (panning && !panning.moved) onSelect(null);
    setPanning(null);
    setDrag(null);
    setResize(null);
  };

  const pct = Math.round(scale * 100);

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{
        backgroundColor: "#f4f1ea",
        backgroundImage: "radial-gradient(circle, #d8d1bd 1px, transparent 1px)",
        backgroundSize: `${DOT_SIZE}px ${DOT_SIZE}px`,
        // Infinite-grid feel: dots travel with pan.
        backgroundPosition: `${viewport.w / 2 + pan.x}px ${viewport.h / 2 + pan.y}px`,
        cursor: panning ? "grabbing" : spaceHeld ? "grab" : "default",
        touchAction: "none",
      }}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        // Double-click empty canvas = fit. Layer double-clicks stopPropagation below.
        if (e.target === e.currentTarget) fitToView();
      }}
    >
      {/* Design sheet positioned by pan + centering */}
      <div
        className="absolute bg-white shadow-[0_24px_60px_-24px_rgba(28,27,26,0.35)] rounded-[3px] ring-1 ring-[#d8d1bd]"
        style={{ left: canvasLeft, top: canvasTop, width: canvasW, height: canvasH }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          <TemplateRenderer template={template} product={product} scale={scale} interactive={false} selectedId={selectedId} />

          {/* Hit areas for drag/resize */}
          {template.layers
            .filter((l) => l.visible)
            .map((layer) => (
              <div
                key={layer.id + "-hit"}
                onPointerDown={(e) => handleLayerPointerDown(e, layer.id)}
                onDoubleClick={(e) => e.stopPropagation()}
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
                  cursor: layer.locked ? "not-allowed" : spaceHeld ? "grab" : "move",
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

      {/* Minimal zoom capsule, bottom-right of canvas */}
      <div
        className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-full border bg-white/90 py-1 pl-1 pr-1 shadow-sm backdrop-blur"
        style={{ borderColor: "#e9e4d6" }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Canvas zoom"
      >
        <button
          onClick={() => setScale(scale / 1.25)}
          disabled={scale <= MIN_SCALE}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={fitToView}
          className="min-w-[3rem] rounded-full px-1 text-center font-mono text-[11px] text-zinc-600 hover:bg-zinc-100"
          title="Fit to view"
        >
          {pct}%
        </button>
        <button
          onClick={() => setScale(scale * 1.25)}
          disabled={scale >= MAX_SCALE}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <span className="mx-0.5 h-4 w-px bg-zinc-200" aria-hidden="true" />
        <button
          onClick={fitToView}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
          aria-label="Fit to view"
          title="Fit to view (double-click canvas)"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Pan hint, bottom-left */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border bg-white/70 px-2.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur" style={{ borderColor: "#e9e4d6" }}>
        drag to pan · ⌘/ctrl+scroll to zoom
      </div>
    </div>
  );
}
