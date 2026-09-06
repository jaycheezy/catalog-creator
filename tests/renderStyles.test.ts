import { describe, expect, it } from "vitest";
import type { Layer, Template } from "@/editor/types";
import {
  MISSING_IMAGE_LABEL,
  applyTextTransform,
  borderValue,
  canvasBox,
  commonLayerStyle,
  contentAlignment,
  displayText,
  finiteOr,
  fontFallbackNotice,
  imageStyle,
  layerBox,
  layerPaddingPx,
  missingImageLabel,
  normalizeOpacity,
  resolveFontFamily,
  rotationTransform,
  sortedVisibleLayers,
  textStyle,
} from "@/editor/renderStyles";

function layer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: "layer_1",
    type: "text",
    name: "Title",
    x: 80,
    y: 790,
    w: 920,
    h: 70,
    rotation: 0,
    z: 2,
    visible: true,
    locked: false,
    style: {},
    content: "{{title}}",
    ...overrides,
  };
}

function template(layers: Layer[]): Template {
  return {
    id: "tpl_stress",
    name: "Stress",
    sizeId: "1:1",
    width: 1080,
    height: 1080,
    background: "#ffffff",
    layers,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("shared render-style projection", () => {
  it("sorts visible layers by z and drops hidden layers", () => {
    const layers = sortedVisibleLayers(template([
      layer({ id: "c", z: 3 }),
      layer({ id: "a", z: 1 }),
      layer({ id: "hidden", z: 0, visible: false }),
      layer({ id: "b", z: 2 }),
    ]));
    expect(layers.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("scales canvas and layer geometry, guarding non-numeric input", () => {
    expect(canvasBox(template([]), 0.5)).toEqual({ width: 540, height: 540 });
    expect(layerBox(layer({ x: 80, y: 790, w: 920, h: 70 }), 0.5)).toEqual({ left: 40, top: 395, width: 460, height: 35 });
    const bad = layer({ x: NaN, w: Number.POSITIVE_INFINITY } as Partial<Layer>);
    expect(layerBox(bad, 1)).toEqual({ left: 0, top: 790, width: 0, height: 70 });
    expect(finiteOr("12", 7)).toBe(7);
  });

  it("projects rotation, opacity, border, radius, and shadow for every layer type", () => {
    const stressful = layer({
      type: "product-image",
      rotation: 12,
      style: { opacity: 0.6, borderWidth: 2, borderColor: "#ff0000", borderRadius: 8, shadow: "0 2px 8px rgba(0,0,0,0.3)" },
    });
    expect(rotationTransform(stressful)).toBe("rotate(12deg)");
    expect(rotationTransform(layer())).toBeUndefined();
    expect(commonLayerStyle(stressful, 1)).toMatchObject({
      opacity: 0.6,
      transform: "rotate(12deg)",
      borderRadius: "8px",
      border: "2px solid #ff0000",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    });
    expect(normalizeOpacity(2)).toBe(1);
    expect(normalizeOpacity(-1)).toBe(0);
    expect(normalizeOpacity("half")).toBe(1);
    expect(borderValue(layer(), 1)).toBeUndefined();
    expect(borderValue(layer({ style: { borderWidth: 1.5, borderColor: "#00ff00" } }), 2)).toBe("3px solid #00ff00");
  });

  it("uses one padding default: 8px for badges, 0px for everything else", () => {
    expect(layerPaddingPx(layer({ type: "badge" }), 1)).toBe(8);
    expect(layerPaddingPx(layer({ type: "text" }), 1)).toBe(0);
    expect(layerPaddingPx(layer({ type: "shape" }), 1)).toBe(0);
    expect(layerPaddingPx(layer({ type: "badge", style: { padding: 4 } }), 2)).toBe(8);
  });

  it("resolves typography with em-to-px letter spacing and documented font fallback", () => {
    const style = textStyle(
      layer({
        style: {
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "Georgia",
          textAlign: "left",
          lineHeight: 1.5,
          letterSpacing: 0.05,
        },
      }),
      1,
    );
    expect(style).toMatchObject({
      fontSize: "42px",
      fontWeight: 700,
      fontFamily: "Inter",
      fontFallback: true,
      textAlign: "left",
      lineHeight: 1.5,
      letterSpacing: "2.1px",
    });
    expect(resolveFontFamily("Arial")).toMatchObject({ fontFamily: "Inter", fallback: false });
    expect(resolveFontFamily(undefined)).toMatchObject({ fontFamily: "Inter", fallback: false });
    expect(fontFallbackNotice("Inter")).toBeNull();
    expect(fontFallbackNotice("Georgia")).toContain("Inter");
    expect(fontFallbackNotice("Arial")).toBeNull();
    expect(fontFallbackNotice(undefined)).toBeNull();
    expect(textStyle(layer({ style: {} }), 1).letterSpacing).toBeUndefined();
  });

  it("aligns content the same way in flex containers and inner text", () => {
    expect(contentAlignment(layer({ style: { textAlign: "left" } }))).toEqual({ justify: "flex-start", align: "left" });
    expect(contentAlignment(layer({ style: { textAlign: "right" } }))).toEqual({ justify: "flex-end", align: "right" });
    expect(contentAlignment(layer())).toEqual({ justify: "center", align: "center" });
  });

  it("applies text transforms in JS so Satori and DOM agree", () => {
    expect(applyTextTransform("Sale now", "uppercase")).toBe("SALE NOW");
    expect(applyTextTransform("Sale Now", "lowercase")).toBe("sale now");
    expect(applyTextTransform("summer sale", "capitalize")).toBe("Summer Sale");
    expect(applyTextTransform("Sale", "none")).toBe("Sale");
    expect(displayText("text", "Mug - Large", "uppercase")).toBe("MUG - LARGE");
    expect(displayText("shape", "", "none")).toBe("");
    expect(displayText("text", "", "none")).toBe("—");
    expect(displayText("badge", "", "none")).toBe("—");
  });

  it("describes product images and the shared missing-image block", () => {
    expect(imageStyle(layer({ type: "product-image", objectFit: "cover" }))).toEqual({
      background: "#fafaf7",
      objectFit: "cover",
    });
    expect(imageStyle(layer({ type: "product-image", style: { background: "#000" } })).background).toBe("#000");
    expect(MISSING_IMAGE_LABEL).toBe("No image");
    expect(missingImageLabel({ id: "MUG-LARGE" })).toBe("No image — MUG-LARGE");
    expect(missingImageLabel(null)).toBe("No image — select product");
  });
});
