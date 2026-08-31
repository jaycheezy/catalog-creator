"use client";

import type { Template, Layer } from "./types";
import { resolveBinding } from "./bindings";
import type { FeedRow } from "@/lib/facebook";

export function TemplateRenderer({
  template,
  product,
  scale = 1,
  interactive = false,
  selectedId,
  onSelect,
  onUpdate,
}: {
  template: Template;
  product: FeedRow | null;
  scale?: number;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<Layer>) => void;
}) {
  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: template.width * scale,
        height: template.height * scale,
        background: template.background,
        // Use actual pixel dimensions scaled via CSS transform for crispness; keep container sized.
      }}
    >
      {/* Render layers sorted by z */}
      {[...template.layers]
        .filter((l) => l.visible)
        .sort((a, b) => a.z - b.z)
        .map((layer) => {
          const isSelected = selectedId === layer.id;
          const commonStyle: React.CSSProperties = {
            position: "absolute",
            left: layer.x * scale,
            top: layer.y * scale,
            width: layer.w * scale,
            height: layer.h * scale,
            transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
            transformOrigin: "center",
            opacity: layer.style.opacity ?? 1,
            zIndex: layer.z,
            borderRadius: layer.style.borderRadius ? layer.style.borderRadius * scale + "px" : undefined,
            background: layer.style.background,
            border: layer.style.borderWidth
              ? `${(layer.style.borderWidth ?? 0) * scale}px solid ${layer.style.borderColor ?? "#000"}`
              : undefined,
            boxShadow: layer.style.shadow,
            padding: layer.style.padding ? layer.style.padding * scale + "px" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: layer.style.textAlign === "left" ? "flex-start" : layer.style.textAlign === "right" ? "flex-end" : "center",
            overflow: "hidden",
            cursor: interactive && !layer.locked ? "move" : "default",
            outline: isSelected ? `2px solid #3b82f6` : undefined,
            outlineOffset: isSelected ? 2 : undefined,
          };

          if (layer.type === "product-image") {
            const src = product?.image_link || "";
            return (
              <div
                key={layer.id}
                style={{
                  ...commonStyle,
                  background: layer.style.background ?? "#fafaf7",
                  justifyContent: "center",
                }}
                onClick={() => onSelect?.(layer.id)}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={product?.title ?? "product"}
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: layer.objectFit ?? "contain",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs" style={{ fontSize: 14 * scale }}>
                    No image — {product ? product.id : "select product"}
                  </div>
                )}
                {interactive && isSelected && <ResizeHandles layer={layer} scale={scale} onUpdate={onUpdate} />}
              </div>
            );
          }

          if (layer.type === "text" || layer.type === "badge" || layer.type === "shape") {
            const text = resolveBinding(layer.content ?? "", product);
            // shape with no content renders as colored box
            const isBadge = layer.type === "badge";
            return (
              <div
                key={layer.id}
                style={{
                  ...commonStyle,
                  background: layer.style.background ?? (isBadge ? "#111" : "transparent"),
                  color: layer.style.color ?? (isBadge ? "#fff" : "#111"),
                  fontSize: (layer.style.fontSize ?? 32) * scale,
                  fontWeight: layer.style.fontWeight ?? 600,
                  fontFamily: layer.style.fontFamily ?? "system-ui, sans-serif",
                  lineHeight: layer.style.lineHeight ?? 1.2,
                  letterSpacing: layer.style.letterSpacing ? `${layer.style.letterSpacing}em` : undefined,
                  textAlign: layer.style.textAlign ?? "center",
                  textTransform: layer.style.textTransform ?? "none",
                  padding: layer.style.padding ? layer.style.padding * scale + "px" : isBadge ? 8 * scale + "px" : undefined,
                }}
                onClick={() => onSelect?.(layer.id)}
              >
                <span
                  style={{
                    width: "100%",
                    textAlign: layer.style.textAlign ?? "center",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    pointerEvents: "none",
                  }}
                >
                  {text || (layer.type === "shape" ? "" : "—")}
                </span>
                {interactive && isSelected && <ResizeHandles layer={layer} scale={scale} onUpdate={onUpdate} />}
              </div>
            );
          }

          return null;
        })}
    </div>
  );
}

function ResizeHandles({
  layer,
  scale,
  onUpdate,
}: {
  layer: Layer;
  scale: number;
  onUpdate?: (id: string, patch: Partial<Layer>) => void;
}) {
  if (!onUpdate || layer.locked) return null;
  // minimal 4 corner handles + move via parent drag
  const handle = (cursor: string, dx: number, dy: number, dw: number, dh: number) => ({
    position: "absolute" as const,
    width: 10,
    height: 10,
    background: "#3b82f6",
    border: "2px solid white",
    borderRadius: 2,
    cursor,
    // positions handled by parent
  });

  // For MVP, handles are visual only; actual drag/resize handled by Canvas wrapper.
  // We keep handles to indicate selection.
  return (
    <>
      <div style={{ position: "absolute", inset: -6, border: "1px dashed #3b82f6", pointerEvents: "none" }} />
      <div style={{ ...handle("nw-resize", 0, 0, 0, 0), left: -5, top: -5 }} />
      <div style={{ ...handle("ne-resize", 0, 0, 0, 0), right: -5, top: -5 }} />
      <div style={{ ...handle("sw-resize", 0, 0, 0, 0), left: -5, bottom: -5 }} />
      <div style={{ ...handle("se-resize", 0, 0, 0, 0), right: -5, bottom: -5 }} />
    </>
  );
}

// Utility to serialize HTML for server raster (satori compatible subset)
export function templateToHtmlString(template: Template, product: FeedRow | null): string {
  // Returns minimal HTML string for server render; keeps same semantics as React render but sans interactivity.
  // Used for AI preview and satori raster.
  const layersHtml = [...template.layers]
    .filter((l) => l.visible)
    .sort((a, b) => a.z - b.z)
    .map((l) => {
      if (l.type === "product-image") {
        const src = product?.image_link || "";
        return `<div style="position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;background:${l.style.background ?? "#fafaf7"};border-radius:${l.style.borderRadius ?? 0}px;overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${src}" style="width:100%;height:100%;object-fit:${l.objectFit ?? "contain"};" /></div>`;
      }
      const text = resolveBinding(l.content ?? "", product).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const bg = l.style.background ?? (l.type === "badge" ? "#111" : "transparent");
      const color = l.style.color ?? (l.type === "badge" ? "#fff" : "#111");
      return `<div style="position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;background:${bg};color:${color};font-size:${l.style.fontSize ?? 32}px;font-weight:${l.style.fontWeight ?? 600};text-align:${l.style.textAlign ?? "center"};border-radius:${l.style.borderRadius ?? 0}px;display:flex;align-items:center;justify-content:center;padding:${l.style.padding ?? 8}px;">${text}</div>`;
    })
    .join("");
  return `<div style="width:${template.width}px;height:${template.height}px;background:${template.background};position:relative;overflow:hidden;">${layersHtml}</div>`;
}
