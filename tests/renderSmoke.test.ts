import { describe, expect, it } from "vitest";
import satori from "satori";
import { renderTemplateElement } from "@/editor/renderElement";
import { compactStyle } from "@/editor/renderStyles";
import { interFonts } from "@/editor/fonts";
import { mapProductToRows } from "@/lib/facebook";
import { shopifyProduct, template } from "./fixtures/catalog";

// Real Satori layout (no ImageResponse mock): proves the exact element tree
// sent to the rasterizer cannot throw "Invalid ... value" at runtime.
const origin = "https://store.example";

function stressTemplate() {
  return {
    ...template,
    layers: [
      {
        id: "layer_image",
        type: "product-image",
        name: "Product Image",
        x: 80, y: 80, w: 920, h: 680,
        rotation: 0, z: 1, visible: true, locked: false,
        style: { background: "#fafaf7", borderRadius: 24, opacity: 1 },
        objectFit: "contain",
      },
      {
        id: "layer_title",
        type: "text",
        name: "Long Title",
        x: 80, y: 790, w: 920, h: 120,
        rotation: 12, z: 2, visible: true, locked: false,
        style: {
          color: "#1a1a1a", fontSize: 42, fontWeight: 700, fontFamily: "Georgia",
          textAlign: "left", lineHeight: 1.5, letterSpacing: 0.05, opacity: 0.6,
          borderWidth: 2, borderColor: "#ff0000", borderRadius: 8,
          shadow: "0 2px 8px rgba(0,0,0,0.3)", padding: 10, textTransform: "uppercase",
        },
        content: "{{title}}",
      },
    ],
  } as typeof template;
}

describe("server render smoke test", () => {
  it("strips undefined style values before Satori", () => {
    expect(compactStyle({ opacity: 1, transform: undefined, border: undefined })).toEqual({ opacity: 1 });
  });

  it("lays out the stress template with bundled fonts without throwing", async () => {
    const [row] = mapProductToRows(shopifyProduct(), origin, "EUR");
    const fonts = interFonts();
    expect(fonts).toHaveLength(3);
    const svg = await satori(renderTemplateElement(stressTemplate(), row), {
      width: 1080,
      height: 1080,
      fonts,
    });
    // Text becomes vector paths: assert the rotation matrix, translucency,
    // red border, and glyph fills made it into the vector output.
    expect(svg).toContain("0.98,0.21,-0.21,0.98");
    expect(svg).toContain('opacity="0.6"');
    expect(svg).toContain("#ff0000");
    expect(svg).toContain('fill="#1a1a1a"');
    expect(svg).not.toContain("undefined");
    // Product content reaches the rasterizer: a different title changes the SVG.
    const other = await satori(
      renderTemplateElement(stressTemplate(), { ...row, title: "Totally different words here", price: "99.00 EUR" }),
      { width: 1080, height: 1080, fonts },
    );
    expect(other).not.toBe(svg);
  });

  it("renders the missing-image block deterministically", async () => {
    const [row] = mapProductToRows(shopifyProduct(), origin, "EUR");
    const fonts = interFonts();
    const missing = { ...row, image_link: "" };
    const first = await satori(renderTemplateElement(stressTemplate(), missing), {
      width: 1080,
      height: 1080,
      fonts,
    });
    expect(first).toContain("#fafaf7");
    const second = await satori(renderTemplateElement(stressTemplate(), missing), {
      width: 1080,
      height: 1080,
      fonts,
    });
    expect(second).toBe(first);
  });
});
