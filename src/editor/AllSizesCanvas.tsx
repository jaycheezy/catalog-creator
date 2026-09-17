"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Template, Layer } from "./types";
import { TemplateRenderer } from "./TemplateRenderer";
import type { FeedRow } from "@/lib/facebook";
import type { SizePresetId } from "@/lib/catalogProject";

const MIN_SCALE = 0.05;
const MAX_SCALE = 2;
const DOT_SIZE = 24;
/** Gap between sheets, in template units. */
const SHEET_GAP = 240;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export type AllSizesSheet = {
  sizeId: SizePresetId;
  label: string;
  template: Template;
  canReset: boolean;
};

/**
 * All placements laid out side-by-side on one infinite canvas, every sheet
 * directly editable (click a sheet to make it active, then drag/resize its
 * layers). Pan/zoom is shared across sheets; mounting fits all sheets.
 */
export function AllSizesCanvas({
  sheets,
  product,
  scale,
  activeId,
  selectedId,
  onScaleChange,
  onActivateSheet,
  onUpdateSheet,
  onResetSheet,
}: {
  sheets: AllSizesSheet[];
  product: FeedRow | null;
  scale: number;
  activeId: string;
  selectedId: string | null;
  onScaleChange: (scale: number) => void;
  onActivateSheet: (templateId: string, layerId: string | null) => void;
  onUpdateSheet: (templateId: string, next: Template) => void;
  onResetSheet: (sizeId: SizePresetId) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState<null | { startX: number; startY: number; origX: number; origY: number; moved: boolean }>(null);
  const [drag, setDrag] = useState<null | { templateId: string; id: string; startX: number; startY: number; origX: number; origY: number }>(null);
  const [resize, setResize] = useState<null | { templateId: string; id: string; handle: string; startX: number; startY: number; orig: Layer }>(null);
  const spaceRef = useRef(false);
  const fittedRef = useRef(false);

  const setScale = useCallback(
    (next: number) => onScaleChange(clampScale(next)),
    [onScaleChange],
  );

  // Row layout in template units, vertically centered on the tallest sheet.
  const layout = useMemo(() => {
    let x = 0;
    const items = sheets.map((sheet) => {
      const item = { sheet, x, y: 0 };
      x += sheet.template.width + SHEET_GAP;
      return item;
    });
    const totalW = Math.max(1, x - SHEET_GAP);
    const totalH = Math.max(1, ...sheets.map((s) => s.template.height));
    for (const item of items) item.y = (totalH - item.sheet.template.height) / 2;
    return { items, totalW, totalH };
  }, [sheets]);

  const originLeft = viewport.w / 2 + pan.x - (layout.totalW * scale) / 2;
  const originTop = viewport.h / 2 + pan.y - (layout.totalH * scale) / 2;

  const fitToView = useCallback(() => {
    // Leave room for the floating toolbar + sheet labels.
    const fit = Math.min((viewport.w - 64) / layout.totalW, (viewport.h - 168) / layout.totalH);
    setPan({ x: 0, y: 0 });
    setScale(Number.isFinite(fit) ? fit : 0.2);
  }, [layout.totalH, layout.totalW, setScale, viewport.h, viewport.w]);

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

  // Fit all sheets on first mount (fresh component per all-sizes session).
  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.w, viewport.h]);

  // Space held => temporary pan tool.
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

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clamped = clampScale(nextScale);
      if (clamped === scale) return;
      // World-space point under the cursor stays pinned.
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = (sx - viewport.w / 2 - pan.x) / scale + layout.totalW / 2;
      const wy = (sy - viewport.h / 2 - pan.y) / scale + layout.totalH / 2;
      setPan({
        x: sx - viewport.w / 2 - (wx - layout.totalW / 2) * clamped,
        y: sy - viewport.h / 2 - (wy - layout.totalH / 2) * clamped,
      });
      onScaleChange(clamped);
    },
    [layout.totalH, layout.totalW, onScaleChange, pan.x, pan.y, scale, viewport.h, viewport.w],
  );

  // Wheel: plain wheel pans, Ctrl/Cmd+wheel (pinch) zooms to cursor.
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

  const ownerOf = useCallback(
    (templateId: string) => sheets.find((s) => s.template.id === templateId)?.template ?? null,
    [sheets],
  );

  const handleLayerPointerDown = (e: React.PointerEvent, templateId: string, id: string) => {
    if (e.button === 1 || spaceRef.current) {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, moved: false });
      return;
    }
    const owner = ownerOf(templateId);
    if (!owner) return;
    if ((e.target as HTMLElement).dataset.handle) {
      const handle = (e.target as HTMLElement).dataset.handle!;
      const orig = owner.layers.find((l) => l.id === id)!;
      if (templateId !== activeId) onActivateSheet(templateId, id);
      setResize({ templateId, id, handle, startX: e.clientX, startY: e.clientY, orig: { ...orig } });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const layer = owner.layers.find((l) => l.id === id);
    if (!layer || layer.locked) return;
    e.stopPropagation();
    onActivateSheet(templateId, id);
    setDrag({ templateId, id, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    // Sheet background: middle-mouse / space pans, otherwise swallow so the
    // background pan doesn't start (click activates via onClick).
    if (e.button === 1 || spaceRef.current) {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, moved: false });
    } else {
      e.stopPropagation();
    }
  };

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) e.preventDefault();
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
      const owner = ownerOf(drag.templateId);
      if (!owner) return;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      const next = owner.layers.map((l) => (l.id === drag.id ? { ...l, x: Math.round(drag.origX + dx), y: Math.round(drag.origY + dy) } : l));
      onUpdateSheet(drag.templateId, { ...owner, layers: next, updatedAt: Date.now() });
    }
    if (resize) {
      const owner = ownerOf(resize.templateId);
      if (!owner) return;
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
      const next = owner.layers.map((l) => (l.id === id ? { ...l, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : l));
      onUpdateSheet(resize.templateId, { ...owner, layers: next, updatedAt: Date.now() });
    }
  };

  const handlePointerUp = () => {
    if (panning && !panning.moved) onActivateSheet(activeId, null);
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
        backgroundPosition: `${viewport.w / 2 + pan.x}px ${viewport.h / 2 + pan.y}px`,
        cursor: panning ? "grabbing" : spaceHeld ? "grab" : "default",
        touchAction: "none",
      }}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) fitToView();
      }}
    >
      {layout.items.map(({ sheet, x, y }) => {
        const left = originLeft + x * scale;
        const top = originTop + y * scale;
        const w = sheet.template.width * scale;
        const h = sheet.template.height * scale;
        const isActive = sheet.template.id === activeId;
        return (
          <div key={sheet.sizeId} className="absolute" style={{ left, top, width: w }}>
            {/* Sheet label */}
            <div
              className="absolute flex items-center justify-start gap-2 whitespace-nowrap cursor-pointer"
              style={{ left: 0, top: -34, height: 26 }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onActivateSheet(sheet.template.id, null);
              }}
              title={`Select ${sheet.label}`}
            >
              <span className="text-[12px] font-medium text-zinc-500">
                {sheet.label}
                {isActive && (
                  <span className="ml-1.5 rounded-full px-1.5 py-px text-[10px] text-white" style={{ background: "#3a5a1e" }}>
                    editing
                  </span>
                )}
              </span>
              {sheet.canReset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetSheet(sheet.sizeId);
                  }}
                  className="rounded-full border bg-white/85 px-2 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur hover:text-zinc-800"
                  style={{ borderColor: "#e9e4d6" }}
                  title="Reset to master adaptation"
                >
                  Reset
                </button>
              )}
            </div>
            {/* Design sheet */}
            <div
              className={`bg-white shadow-[0_24px_60px_-24px_rgba(28,27,26,0.35)] rounded-[3px] ${isActive ? "ring-2 ring-[#3a5a1e]" : "ring-1 ring-[#d8d1bd]"}`}
              style={{ width: w, height: h }}
              onPointerDown={handleSheetPointerDown}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onActivateSheet(sheet.template.id, null);
              }}
            >
              <div className="relative" style={{ width: w, height: h }}>
                <TemplateRenderer template={sheet.template} product={product} scale={scale} interactive={false} selectedId={isActive ? selectedId : null} />

                {sheet.template.layers
                  .filter((l) => l.visible)
                  .map((layer) => (
                    <div
                      key={layer.id + "-hit"}
                      onPointerDown={(e) => handleLayerPointerDown(e, sheet.template.id, layer.id)}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivateSheet(sheet.template.id, layer.id);
                      }}
                      style={{
                        position: "absolute",
                        left: layer.x * scale,
                        top: layer.y * scale,
                        width: layer.w * scale,
                        height: layer.h * scale,
                        cursor: layer.locked ? "not-allowed" : spaceHeld ? "grab" : "move",
                        background: "transparent",
                        border: isActive && selectedId === layer.id ? "2px solid #3b82f6" : "1px solid transparent",
                        zIndex: layer.z + 100,
                      }}
                    >
                      {isActive && selectedId === layer.id && !layer.locked && (
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
      })}

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
          title="Fit all sizes to view"
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
          aria-label="Fit all sizes to view"
          title="Fit all sizes (double-click canvas)"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Pan hint, bottom-left */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border bg-white/70 px-2.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur" style={{ borderColor: "#e9e4d6" }}>
        click a sheet to edit · drag to pan · ⌘/ctrl+scroll to zoom
      </div>
    </div>
  );
}
