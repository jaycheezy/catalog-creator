import type { Template, Layer, SizePreset } from "./types";

/**
 * Auto-layout: adapt layers from old size to new size.
 * Keeps bottom-anchored layers (title, price) fixed distance from bottom,
 * top-anchored layers fixed from top, and stretches product-image to fill.
 * No new dependencies, pure math — works for any custom layers via heuristic.
 */
export function adaptTemplateToSize(template: Template, newPreset: SizePreset): Template {
  const oldW = template.width;
  const oldH = template.height;
  const newW = newPreset.width;
  const newH = newPreset.height;

  // If same size, no change
  if (oldW === newW && oldH === newH) return { ...template, sizeId: newPreset.id, updatedAt: Date.now() };

  const newLayers = template.layers.map((layer) => {
    // Infer anchoring
    const distFromBottom = oldH - (layer.y + layer.h);
    const distFromTop = layer.y;
    const distFromLeft = layer.x;
    const distFromRight = oldW - (layer.x + layer.w);

    const isBottomAnchored = distFromBottom < 260; // title, price, badges near bottom
    const isTopAnchored = distFromTop < 120;
    const isFullWidth = distFromLeft < 100 && distFromRight < 100 && layer.w > oldW * 0.6;
    const isCentered = Math.abs((layer.x + layer.w / 2) - oldW / 2) < 5;

    let newX = layer.x;
    let newY = layer.y;
    let newWLayer = layer.w;
    let newHLayer = layer.h;

    // Width adaptation
    if (isFullWidth) {
      // Keep 80px margins
      newX = 80;
      newWLayer = newW - 160;
    } else if (isCentered) {
      newWLayer = layer.w; // keep same width, re-center
      newX = Math.round(newW / 2 - layer.w / 2);
    } else {
      // Proportional
      newX = Math.round((layer.x / oldW) * newW);
      newWLayer = Math.round((layer.w / oldW) * newW);
    }

    // Height / Y adaptation — key for 1080->1350->1920
    if (layer.type === "product-image" && layer.h > oldH * 0.5) {
      // Stretch product image to fill available height above footer
      // Footer is 320px in default, keep that
      const footer = 320;
      newY = 80;
      newHLayer = newH - footer;
      // Keep margins already handled for width
    } else if (isBottomAnchored) {
      // Keep distance from bottom
      newY = newH - distFromBottom - layer.h;
    } else if (isTopAnchored) {
      newY = layer.y;
      // keep height
    } else {
      // Middle — scale proportionally
      newY = Math.round((layer.y / oldH) * newH);
      // keep height
    }

    // Clamp to canvas
    newX = Math.max(0, Math.min(newX, newW - 20));
    newY = Math.max(0, Math.min(newY, newH - 20));
    newWLayer = Math.max(20, Math.min(newWLayer, newW - newX));
    newHLayer = Math.max(20, Math.min(newHLayer, newH - newY));

    return {
      ...layer,
      x: Math.round(newX),
      y: Math.round(newY),
      w: Math.round(newWLayer),
      h: Math.round(newHLayer),
    };
  });

  return {
    ...template,
    sizeId: newPreset.id,
    width: newW,
    height: newH,
    layers: newLayers,
    updatedAt: Date.now(),
  };
}

export function generateAllSizeVariants(template: Template, presets: SizePreset[]): Template[] {
  return presets.map((p) => adaptTemplateToSize(template, p));
}
