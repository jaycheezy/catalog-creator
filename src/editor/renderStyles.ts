// Shared render-style projection for Catalog Forge.
//
// Both the browser `TemplateRenderer` and the server `/api/render` PNG route
// must call these pure helpers so the image delivered to Meta preserves the
// styling the merchant approved. This module is server-safe: it must not
// import a `"use client"` module, React, or any DOM API.
//
// Owned by story c-reliable-render-parity. Placement persistence, R2 caching,
// and publication read these styles but must not change them here without
// updating that story's spec.

import type { Layer, Template } from "./types";
import type { FeedRow } from "@/lib/facebook";

/** Bump when the projected style contract changes (used by later render caching). */
export const RENDERER_CONTRACT_VERSION = 1;

/** Unified padding defaults (px at 1x). The browser and server previously disagreed here. */
export const DEFAULT_TEXT_PADDING = 0;
export const DEFAULT_BADGE_PADDING = 8;

/** Neutral block behind a product layer whose row has no image. */
export const MISSING_IMAGE_BACKGROUND = "#fafaf7";
export const MISSING_IMAGE_LABEL = "No image";
export const MISSING_IMAGE_COLOR = "#a1a1a1";
export const MISSING_IMAGE_FONT_SIZE = 14;

/**
 * Identical placeholder copy on every surface (browser preview, server PNG,
 * HTML string): the label plus the affected product, never a bare box on one
 * side and a different caption on another.
 */
export function missingImageLabel(product: Pick<FeedRow, "id"> | null): string {
  return `${MISSING_IMAGE_LABEL} — ${product ? product.id : "select product"}`;
}

/** Fallback when a saved fontFamily cannot be rendered by the server bundle. */
export const FALLBACK_FONT_FAMILY = "Inter";

/**
 * Font families the server PNG bundle can render with real data. The Inter
 * woff bytes are embedded in `src/editor/fonts.ts` (generated from
 * `@fontsource/inter`, OFL licensed) and passed to `ImageResponse`, so the
 * whole sans group renders as Inter on both sides. Serif and monospace stacks
 * have no bundled data and fall back to Inter; the editor flags that so saved
 * designs never promise a face the export cannot draw.
 */
const SUPPORTED_FONT_TOKENS = new Set(
  [
    "inter",
    "system-ui",
    "sans-serif",
    "arial",
    "helvetica",
    "verdana",
  ].map((token) => token.toLowerCase()),
);

export function resolveFontFamily(fontFamily: string | undefined): { fontFamily: string; fallback: boolean } {
  const first = (fontFamily ?? "").split(",")[0]?.replace(/["']/g, "").trim() ?? "";
  if (!first) return { fontFamily: FALLBACK_FONT_FAMILY, fallback: false };
  // The whole sans group resolves to bundled Inter so the browser preview
  // (Inter webfont) and the server PNG (Inter font data) draw the same face.
  if (SUPPORTED_FONT_TOKENS.has(first.toLowerCase())) return { fontFamily: FALLBACK_FONT_FAMILY, fallback: false };
  return { fontFamily: FALLBACK_FONT_FAMILY, fallback: true };
}

/** Editor-visible notice for a font that renders with the documented fallback. */
export function fontFallbackNotice(fontFamily: string | undefined): string | null {
  if (!fontFamily?.trim()) return null;
  return resolveFontFamily(fontFamily).fallback
    ? `“${fontFamily}” has no bundled export face; PNGs render it as Inter.`
    : null;
}

/** Guard so invalid numeric style values never reach Satori. */
export function finiteOr(value: unknown, fallback: number): number {  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Clamp opacity into 0..1; non-numeric input becomes 1 (fully visible). */
export function normalizeOpacity(value: unknown): number {
  const numeric = finiteOr(value, 1);
  return Math.min(1, Math.max(0, numeric));
}

/**
 * Remove `undefined` entries from a freshly built style object. React DOM
 * ignores undefined, but Satori rejects values such as `transform: undefined`
 * with an "Invalid ... value" render error (HTTP 500 from `/api/render`).
 * Mutates and returns the same object; call it on inline literals only.
 */
export function compactStyle<T extends object>(style: T): T {
  for (const key of Object.keys(style) as (keyof T)[]) {
    if (style[key] === undefined) delete style[key];
  }
  return style;
}

/** Visible layers in paint order (lowest `z` first). */
export function sortedVisibleLayers(template: Template): Layer[] {
  return [...template.layers].filter((layer) => layer.visible).sort((a, b) => a.z - b.z);
}

/** Canvas box in px for a scale factor (browser preview scales, server uses 1). */
export function canvasBox(template: Template, scale = 1): { width: number; height: number } {
  return {
    width: finiteOr(template.width, 1080) * finiteOr(scale, 1),
    height: finiteOr(template.height, 1080) * finiteOr(scale, 1),
  };
}

/** Absolute layer geometry in px. */
export function layerBox(layer: Layer, scale = 1): { left: number; top: number; width: number; height: number } {
  const factor = finiteOr(scale, 1);
  return {
    left: finiteOr(layer.x, 0) * factor,
    top: finiteOr(layer.y, 0) * factor,
    width: Math.max(0, finiteOr(layer.w, 0) * factor),
    height: Math.max(0, finiteOr(layer.h, 0) * factor),
  };
}

/** Rotation as a CSS transform string. Satori and DOM both accept `rotate(Xdeg)`. */
export function rotationTransform(layer: Layer): string | undefined {
  const rotation = finiteOr(layer.rotation, 0);
  return rotation ? `rotate(${rotation}deg)` : undefined;
}

/** Border shorthand (`"2px solid #000"`), shared so both renderers agree. */
export function borderValue(layer: Layer, scale = 1): string | undefined {
  const width = finiteOr(layer.style.borderWidth, 0) * finiteOr(scale, 1);
  if (width <= 0) return undefined;
  return `${width}px solid ${layer.style.borderColor ?? "#000000"}`;
}

/** Unified padding in px: badges default to 8, all other layers to 0. */
export function layerPaddingPx(layer: Layer, scale = 1): number {
  const factor = finiteOr(scale, 1);
  if (layer.style.padding !== undefined) return finiteOr(layer.style.padding, 0) * factor;
  return (layer.type === "badge" ? DEFAULT_BADGE_PADDING : DEFAULT_TEXT_PADDING) * factor;
}

/** Horizontal content alignment shared by flex containers and inner text. */
export function contentAlignment(layer: Layer): { justify: string; align: "left" | "center" | "right" } {
  const align = layer.style.textAlign ?? "center";
  return {
    justify: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
    align,
  };
}

/**
 * Apply `textTransform` to the resolved string in JS instead of CSS.
 * Satori ignores `text-transform`, so doing it here keeps both outputs equal.
 */
export function applyTextTransform(text: string, transform: Layer["style"]["textTransform"]): string {
  switch (transform ?? "none") {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/(^|\s)(\S)/g, (_, boundary: string, char: string) => boundary + char.toUpperCase());
    default:
      return text;
  }
}

/**
 * Final display text for a layer. Shapes with no content render as an empty
 * box (never placeholder text); text/badge layers with no content render an
 * em dash so a missing binding is visible in previews and exports alike.
 */
export function displayText(
  layerType: Layer["type"],
  resolvedText: string,
  transform: Layer["style"]["textTransform"] = "none",
): string {
  if (!resolvedText) return layerType === "shape" ? "" : "—";
  return applyTextTransform(resolvedText, transform);
}

export type ProjectedTextStyle = {
  background: string;
  color: string;
  fontSize: string;
  fontWeight: number;
  fontFamily: string;
  fontFallback: boolean;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  /** px string; undefined when no letter spacing is set. */
  letterSpacing: string | undefined;
  padding: string;
};

/** Normalized text/badge/shape typography shared by both renderers. */
export function textStyle(layer: Layer, scale = 1): ProjectedTextStyle {
  const factor = finiteOr(scale, 1);
  const isBadge = layer.type === "badge";
  const fontSize = finiteOr(layer.style.fontSize, 32) * factor;
  const { fontFamily, fallback } = resolveFontFamily(layer.style.fontFamily);
  const spacing = finiteOr(layer.style.letterSpacing, 0);
  return {
    background: layer.style.background ?? (isBadge ? "#111111" : "transparent"),
    color: layer.style.color ?? (isBadge ? "#ffffff" : "#111111"),
    fontSize: `${fontSize}px`,
    fontWeight: finiteOr(layer.style.fontWeight, 600),
    fontFamily,
    fontFallback: fallback,
    textAlign: layer.style.textAlign ?? "center",
    lineHeight: finiteOr(layer.style.lineHeight, 1.2),
    letterSpacing: spacing ? `${spacing * fontSize}px` : undefined,
    padding: `${layerPaddingPx(layer, scale)}px`,
  };
}

export type ProjectedCommonStyle = {
  opacity: number;
  transform: string | undefined;
  borderRadius: string | undefined;
  border: string | undefined;
  boxShadow: string | undefined;
};

/** Geometry-independent layer chrome: rotation, opacity, radius, border, shadow. */
export function commonLayerStyle(layer: Layer, scale = 1): ProjectedCommonStyle {
  const factor = finiteOr(scale, 1);
  const radius = finiteOr(layer.style.borderRadius, 0) * factor;
  return {
    opacity: normalizeOpacity(layer.style.opacity),
    transform: rotationTransform(layer),
    borderRadius: radius ? `${radius}px` : undefined,
    border: borderValue(layer, scale),
    boxShadow: layer.style.shadow || undefined,
  };
}

export type ProjectedImageStyle = {
  background: string;
  objectFit: "contain" | "cover" | "fill";
};

/** Product-image fit and fallback background. */
export function imageStyle(layer: Layer): ProjectedImageStyle {
  return {
    background: layer.style.background ?? MISSING_IMAGE_BACKGROUND,
    objectFit: layer.objectFit ?? "contain",
  };
}
