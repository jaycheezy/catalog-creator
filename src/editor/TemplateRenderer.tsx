"use client";

import type { Template, Layer } from "./types";
import { resolveBinding } from "./bindings";
import type { FeedRow } from "@/lib/facebook";
import {
  MISSING_IMAGE_BACKGROUND,
  MISSING_IMAGE_COLOR,
  MISSING_IMAGE_FONT_SIZE,
  canvasBox,
  commonLayerStyle,
  contentAlignment,
  displayText,
  imageStyle,
  layerBox,
  missingImageLabel,
  normalizeOpacity,
  sortedVisibleLayers,
  textStyle,
} from "./renderStyles";

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
  const canvas = canvasBox(template, scale);
  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: canvas.width,
        height: canvas.height,
        background: template.background,
        overflow: "hidden",
        // Use actual pixel dimensions scaled via CSS transform for crispness; keep container sized.
      }}
    >
      {/* Render layers sorted by z */}
      {sortedVisibleLayers(template)
        .map((layer) => {
          const isSelected = selectedId === layer.id;
          const box = layerBox(layer, scale);
          const shared = commonLayerStyle(layer, scale);
          const alignment = contentAlignment(layer);
          const commonStyle: React.CSSProperties = {
            position: "absolute",
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            transform: shared.transform,
            transformOrigin: "center",
            opacity: normalizeOpacity(layer.style.opacity),
            zIndex: layer.z,
            borderRadius: shared.borderRadius,
            background: layer.style.background,
            border: shared.border,
            boxShadow: shared.boxShadow,
            overflow: "hidden",
            cursor: interactive && !layer.locked ? "move" : "default",
            outline: isSelected ? `2px solid #3b82f6` : undefined,
            outlineOffset: isSelected ? 2 : undefined,
          };

          if (layer.type === "product-image") {
            const src = product?.image_link || "";
            const image = imageStyle(layer);
            return (
              <div
                key={layer.id}
                style={{
                  ...commonStyle,
                  background: image.background,
                  display: "flex",
                  alignItems: "center",
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
                      objectFit: image.objectFit,
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs" style={{ fontSize: MISSING_IMAGE_FONT_SIZE * scale, background: MISSING_IMAGE_BACKGROUND, color: MISSING_IMAGE_COLOR }}>
                    {missingImageLabel(product)}
                  </div>
                )}
                {interactive && isSelected && <ResizeHandles layer={layer} onUpdate={onUpdate} />}
              </div>
            );
          }

          if (layer.type === "text" || layer.type === "badge" || layer.type === "shape") {
            const resolved = resolveBinding(layer.content ?? "", product);
            // shape with no content renders as colored box
            const text = textStyle(layer, scale);
            return (
              <div
                key={layer.id}
                style={{
                  ...commonStyle,
                  background: text.background,
                  color: text.color,
                  fontSize: text.fontSize,
                  fontWeight: text.fontWeight,
                  fontFamily: text.fontFamily,
                  lineHeight: text.lineHeight,
                  letterSpacing: text.letterSpacing,
                  textAlign: text.textAlign,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: alignment.justify,
                  padding: text.padding,
                }}
                onClick={() => onSelect?.(layer.id)}
              >
                <span
                  style={{
                    width: "100%",
                    textAlign: text.textAlign,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    pointerEvents: "none",
                  }}
                >
                  {displayText(layer.type, resolved, layer.style.textTransform)}
                </span>
                {interactive && isSelected && <ResizeHandles layer={layer} onUpdate={onUpdate} />}
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
  onUpdate,
}: {
  layer: Layer;
  onUpdate?: (id: string, patch: Partial<Layer>) => void;
}) {
  if (!onUpdate || layer.locked) return null;
  // minimal 4 corner handles + move via parent drag
  const handle = (cursor: string) => ({
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
      <div style={{ ...handle("nw-resize"), left: -5, top: -5 }} />
      <div style={{ ...handle("ne-resize"), right: -5, top: -5 }} />
      <div style={{ ...handle("sw-resize"), left: -5, bottom: -5 }} />
      <div style={{ ...handle("se-resize"), right: -5, bottom: -5 }} />
    </>
  );
}

// Utility to serialize HTML for server raster (satori compatible subset)
export function templateToHtmlString(template: Template, product: FeedRow | null): string {
  // Returns minimal HTML string for server render; keeps same semantics as React render but sans interactivity.
  // Built from the shared projection so string, browser, and PNG outputs agree.
  // Used for AI preview and satori raster.
  const layersHtml = sortedVisibleLayers(template)
    .map((l) => {
      const box = layerBox(l, 1);
      const shared = commonLayerStyle(l, 1);
      const geometry = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;overflow:hidden;`;
      const chrome = [
        shared.transform ? `transform:${shared.transform};` : "",
        `opacity:${shared.opacity};`,
        shared.borderRadius ? `border-radius:${shared.borderRadius};` : "",
        shared.border ? `border:${shared.border};` : "",
        shared.boxShadow ? `box-shadow:${shared.boxShadow};` : "",
      ].join("");
      if (l.type === "product-image") {
        const image = imageStyle(l);
        const src = product?.image_link || "";
        const inner = src
          ? `<img src="${src}" style="width:100%;height:100%;object-fit:${image.objectFit};" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${MISSING_IMAGE_BACKGROUND};color:${MISSING_IMAGE_COLOR};font-size:${MISSING_IMAGE_FONT_SIZE}px;">${missingImageLabel(product)}</div>`;
        return `<div style="${geometry}${chrome}background:${image.background};display:flex;align-items:center;justify-content:center;">${inner}</div>`;
      }
      const text = displayText(l.type, resolveBinding(l.content ?? "", product), l.style.textTransform)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const style = textStyle(l, 1);
      const alignment = contentAlignment(l);
      return `<div style="${geometry}${chrome}background:${style.background};color:${style.color};font-size:${style.fontSize};font-weight:${style.fontWeight};font-family:${style.fontFamily};line-height:${style.lineHeight};${style.letterSpacing ? `letter-spacing:${style.letterSpacing};` : ""}display:flex;align-items:center;justify-content:${alignment.justify};padding:${style.padding};"><span style="width:100%;text-align:${style.textAlign};white-space:pre-wrap;word-break:break-word;">${text}</span></div>`;
    })
    .join("");
  const canvas = canvasBox(template, 1);
  return `<div style="width:${canvas.width}px;height:${canvas.height}px;background:${template.background};position:relative;overflow:hidden;display:flex;">${layersHtml}</div>`;
}
