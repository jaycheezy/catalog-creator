// Server-side template element for `/api/render` (story c-reliable-render-parity).
//
// Builds the exact JSX passed to `ImageResponse` from the shared projection.
// Every style object goes through `compactStyle`: React DOM tolerates
// `undefined` values, but Satori rejects them with an "Invalid ... value"
// error, which surfaces as HTTP 500 from the render route. Keep this module
// free of `"use client"` imports so tests can feed its output to real Satori.

import type { CSSProperties, ReactElement } from "react";
import type { Template } from "./types";
import type { FeedRow } from "@/lib/facebook";
import { resolveBinding } from "./bindings";
import {
  MISSING_IMAGE_BACKGROUND,
  MISSING_IMAGE_COLOR,
  MISSING_IMAGE_FONT_SIZE,
  canvasBox,
  commonLayerStyle,
  compactStyle,
  contentAlignment,
  displayText,
  imageStyle,
  layerBox,
  missingImageLabel,
  sortedVisibleLayers,
  textStyle,
} from "./renderStyles";

export function renderTemplateElement(template: Template, product: FeedRow): ReactElement {
  const canvas = canvasBox(template, 1);
  const layers = sortedVisibleLayers(template);
  return (
    <div
      style={{
        width: `${canvas.width}px`,
        height: `${canvas.height}px`,
        background: template.background || "#ffffff",
        position: "relative",
        overflow: "hidden",
        display: "flex",
      }}
    >
      {layers.map((layer) => {
        const box = layerBox(layer, 1);
        const shared = commonLayerStyle(layer, 1);
        const geometry: CSSProperties = {
          position: "absolute",
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          overflow: "hidden",
        };
        const chrome = compactStyle({
          opacity: shared.opacity,
          transform: shared.transform,
          transformOrigin: "center" as const,
          borderRadius: shared.borderRadius,
          border: shared.border,
          boxShadow: shared.boxShadow,
        });
        if (layer.type === "product-image") {
          const src = product!.image_link;
          const image = imageStyle(layer);
          return (
            <div
              key={layer.id}
              style={{
                ...geometry,
                ...chrome,
                background: image.background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  width={box.width}
                  height={box.height}
                  style={{ width: "100%", height: "100%", objectFit: image.objectFit }}
                  alt=""
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: MISSING_IMAGE_BACKGROUND,
                    color: MISSING_IMAGE_COLOR,
                    fontSize: `${MISSING_IMAGE_FONT_SIZE}px`,
                  }}
                >
                  {missingImageLabel(product)}
                </div>
              )}
            </div>
          );
        }
        const resolved = resolveBinding(layer.content ?? "", product);
        const text = displayText(layer.type, resolved, layer.style.textTransform);
        const style = textStyle(layer, 1);
        const alignment = contentAlignment(layer);
        return (
          <div
            key={layer.id}
            style={{
              ...geometry,
              ...chrome,
              background: style.background,
              color: style.color,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontFamily: style.fontFamily,
              lineHeight: style.lineHeight,
              ...compactStyle({ letterSpacing: style.letterSpacing }),
              display: "flex",
              alignItems: "center",
              justifyContent: alignment.justify,
              padding: style.padding,
            }}
          >
            <span style={{ width: "100%", textAlign: style.textAlign, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {text || ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
