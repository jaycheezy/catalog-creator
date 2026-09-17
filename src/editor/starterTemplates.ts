import type { Layer, Template } from "./types";
import { getPresetById } from "./types";

export type StarterTemplate = {
  id: string;
  name: string;
  blurb: string;
  build(sizeId: string): Template;
};

const FONT = "system-ui, sans-serif";

function uid(): string {
  return `layer_${Math.random().toString(36).slice(2, 7)}`;
}

/** n guaranteed-unique layer ids in the required `layer_xxxxx` style. */
function makeIds(n: number): string[] {
  const ids = new Set<string>();
  while (ids.size < n) ids.add(uid());
  return [...ids];
}

function templateId(): string {
  return `tpl_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 28);
}

function geo(sizeId: string) {
  const preset = getPresetById(sizeId);
  const width = preset.width;
  const height = preset.height;
  const margin = Math.round(width * 0.074);
  const topM = Math.round(height * 0.06);
  const botM = Math.round(height * 0.06);
  const gap = Math.max(8, Math.round(height * 0.02));
  const uw = width - margin * 2;
  // Font base uses the smaller dimension so short landscape canvases still fit text.
  const fb = Math.min(width, height);
  return { preset, width, height, margin, topM, botM, gap, uw, fb };
}

/** Centered x so that x + w <= width always holds (no round-up overflow). */
function centerX(width: number, w: number): number {
  return Math.floor((width - w) / 2);
}

function baseTemplate(
  preset: { id: string; width: number; height: number },
  name: string,
  background: string,
  layers: Layer[],
): Template {
  const now = Date.now();
  return {
    id: templateId(),
    name,
    sizeId: preset.id,
    width: preset.width,
    height: preset.height,
    background,
    layers,
    createdAt: now,
    updatedAt: now,
  };
}

function imageLayer(id: string, z: number, x: number, y: number, w: number, h: number, bg: string): Layer {
  return {
    id,
    type: "product-image",
    name: "Product Image",
    x,
    y,
    w,
    h,
    rotation: 0,
    z,
    visible: true,
    locked: false,
    style: { background: bg, borderRadius: 24, opacity: 1 },
    objectFit: "cover",
  };
}

function textLayer(
  id: string,
  z: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  style: Layer["style"],
): Layer {
  return {
    id,
    type: "text",
    name,
    x,
    y,
    w,
    h,
    rotation: 0,
    z,
    visible: true,
    locked: false,
    style: { fontFamily: FONT, textAlign: "center", opacity: 1, ...style },
    content,
  };
}

function badgeLayer(
  id: string,
  z: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  style: Layer["style"],
  rotation = 0,
): Layer {
  return {
    id,
    type: "badge",
    name,
    x,
    y,
    w,
    h,
    rotation,
    z,
    visible: true,
    locked: false,
    style: { fontFamily: FONT, textAlign: "center", borderRadius: 999, opacity: 1, ...style },
    content,
  };
}

function shapeLayer(
  id: string,
  z: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  background: string,
  borderRadius: number,
): Layer {
  return {
    id,
    type: "shape",
    name,
    x,
    y,
    w,
    h,
    rotation: 0,
    z,
    visible: true,
    locked: false,
    style: { background, borderRadius, opacity: 1 },
  };
}

function buildProductHighlight(sizeId: string): Template {
  const g = geo(sizeId);
  const { preset, width, height, margin, topM, botM, gap, uw, fb } = g;
  const [imageId, titleId, priceId] = makeIds(3);
  const titleH = Math.max(44, Math.round(height * 0.075));
  const badgeH = Math.max(48, Math.round(height * 0.075));
  const badgeW = Math.max(40, Math.min(uw, Math.round(width * 0.42)));
  const imageH = height - topM - botM - titleH - badgeH - gap * 2;
  let y = topM;
  const image = imageLayer(imageId, 1, margin, y, uw, imageH, "#f4f4f2");
  y += imageH + gap;
  const title = textLayer(titleId, 2, "Title", margin, y, uw, titleH, "{{title}}", {
    color: "#1a1a1a",
    fontSize: Math.round(fb * 0.039),
    fontWeight: 700,
    lineHeight: 1.15,
  });
  y += titleH + gap;
  const price = badgeLayer(
    priceId,
    3,
    "Price Badge",
    centerX(width, badgeW),
    y,
    badgeW,
    badgeH,
    "{{price}}",
    { background: "#111111", color: "#ffffff", fontSize: Math.round(fb * 0.032), fontWeight: 700, padding: 8 },
  );
  return baseTemplate(preset, "Product Highlight", "#ffffff", [image, title, price]);
}

function buildSpecialOffer(sizeId: string): Template {
  const g = geo(sizeId);
  const { preset, width, height, margin, topM, botM, gap, uw, fb } = g;
  const [stripId, imageId, saleId, priceId] = makeIds(4);
  const stripH = Math.max(40, Math.round(height * 0.08));
  const saleW = Math.max(40, Math.min(uw, Math.round(width * 0.6)));
  const saleH = Math.max(48, Math.round(height * 0.085));
  // Reserve tilt padding inside the badge slot so the rotated corners stay in-bounds.
  const tiltPad = Math.ceil(Math.sin((5 * Math.PI) / 180) * (saleW / 2)) + 6;
  const saleSlot = saleH + tiltPad * 2;
  const priceH = Math.max(40, Math.round(height * 0.06));
  const imageH = height - topM - botM - stripH - saleSlot - priceH - gap * 3;
  let y = topM;
  const strip = shapeLayer(stripId, 1, "Sale Strip", margin, y, uw, stripH, "#dc2626", 16);
  y += stripH + gap;
  const image = imageLayer(imageId, 2, margin, y, uw, imageH, "#262626");
  y += imageH + gap;
  const saleY = y;
  const sale = badgeLayer(
    saleId,
    3,
    "Sale Badge",
    centerX(width, saleW),
    saleY + tiltPad,
    saleW,
    saleH,
    "{{discount_pct}}% OFF",
    { background: "#dc2626", color: "#ffffff", fontSize: Math.round(fb * 0.034), fontWeight: 800, padding: 8 },
    -5,
  );
  y += saleSlot + gap;
  const price = textLayer(priceId, 4, "Price", margin, y, uw, priceH, "{{price}}", {
    color: "#ffffff",
    fontSize: Math.round(fb * 0.032),
    fontWeight: 700,
    lineHeight: 1.15,
  });
  return baseTemplate(preset, "Special Offer", "#171717", [strip, image, sale, price]);
}

function buildNewArrival(sizeId: string): Template {
  const g = geo(sizeId);
  const { preset, width, height, margin, topM, botM, gap, uw, fb } = g;
  const [imageId, vendorId, titleId, priceId] = makeIds(4);
  const vendorH = Math.max(40, Math.round(height * 0.055));
  const titleH = Math.max(44, Math.round(height * 0.07));
  const badgeH = Math.max(44, Math.round(height * 0.07));
  const badgeW = Math.max(40, Math.min(uw, Math.round(width * 0.38)));
  const imageH = height - topM - botM - vendorH - titleH - badgeH - gap * 3;
  let y = topM;
  const image = imageLayer(imageId, 1, margin, y, uw, imageH, "#ffffff");
  y += imageH + gap;
  const vendor = textLayer(vendorId, 2, "Vendor Eyebrow", margin, y, uw, vendorH, "{{vendor}}", {
    color: "#6b7280",
    fontSize: Math.round(fb * 0.022),
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.12,
    textTransform: "uppercase",
  });
  y += vendorH + gap;
  const title = textLayer(titleId, 3, "Title", margin, y, uw, titleH, "{{title}}", {
    color: "#1a1a1a",
    fontSize: Math.round(fb * 0.036),
    fontWeight: 600,
    lineHeight: 1.15,
  });
  y += titleH + gap;
  const price = badgeLayer(
    priceId,
    4,
    "Price Badge",
    centerX(width, badgeW),
    y,
    badgeW,
    badgeH,
    "{{price}}",
    { background: "#1a1a1a", color: "#ffffff", fontSize: Math.round(fb * 0.03), fontWeight: 700, padding: 8 },
  );
  return baseTemplate(preset, "New Arrival", "#fafaf7", [image, vendor, title, price]);
}

function buildSeasonal(sizeId: string): Template {
  const g = geo(sizeId);
  const { preset, width, height, margin, topM, botM, gap, uw, fb } = g;
  const [imageId, panelId, titleId, badgeId] = makeIds(4);
  const titleH = Math.max(44, Math.round(height * 0.07));
  const badgeH = Math.max(44, Math.round(height * 0.07));
  const badgeW = Math.max(40, Math.min(uw, Math.round(width * 0.4)));
  const pad = Math.max(10, Math.round(height * 0.015));
  const panelH = pad + titleH + gap + badgeH + pad;
  const imageH = height - topM - botM - gap - panelH;
  let y = topM;
  const image = imageLayer(imageId, 1, margin, y, uw, imageH, "#e3ede3");
  y += imageH + gap;
  const panelY = y;
  const panel = shapeLayer(panelId, 2, "Tint Panel", margin, panelY, uw, panelH, "#cfe3cf", 24);
  const title = textLayer(titleId, 3, "Title", margin, panelY + pad, uw, titleH, "{{title}}", {
    color: "#1d3a24",
    fontSize: Math.round(fb * 0.036),
    fontWeight: 700,
    lineHeight: 1.15,
  });
  const badge = badgeLayer(
    badgeId,
    4,
    "Price Badge",
    centerX(width, badgeW),
    panelY + pad + titleH + gap,
    badgeW,
    badgeH,
    "{{price}}",
    { background: "#2f6b33", color: "#ffffff", fontSize: Math.round(fb * 0.03), fontWeight: 700, padding: 8 },
  );
  return baseTemplate(preset, "Seasonal", "#edf5ec", [image, panel, title, badge]);
}

function buildDiscount(sizeId: string): Template {
  const g = geo(sizeId);
  const { preset, width, height, margin, topM, botM, gap, uw, fb } = g;
  const [saleId, imageId, titleId, priceId] = makeIds(4);
  const saleH = Math.max(44, Math.round(height * 0.075));
  const saleW = Math.max(40, Math.min(uw, Math.round(width * 0.55)));
  const titleH = Math.max(44, Math.round(height * 0.07));
  const priceH = Math.max(48, Math.round(height * 0.08));
  const priceW = Math.max(40, Math.min(uw, Math.round(width * 0.46)));
  const imageH = height - topM - botM - saleH - titleH - priceH - gap * 3;
  let y = topM;
  const sale = badgeLayer(
    saleId,
    1,
    "Sale Badge",
    centerX(width, saleW),
    y,
    saleW,
    saleH,
    "{{discount_pct}}% OFF",
    { background: "#ea580c", color: "#ffffff", fontSize: Math.round(fb * 0.032), fontWeight: 800, padding: 8 },
  );
  y += saleH + gap;
  const image = imageLayer(imageId, 2, margin, y, uw, imageH, "#fdeedf");
  y += imageH + gap;
  const title = textLayer(titleId, 3, "Title", margin, y, uw, titleH, "{{title}}", {
    color: "#431407",
    fontSize: Math.round(fb * 0.034),
    fontWeight: 700,
    lineHeight: 1.15,
  });
  y += titleH + gap;
  const price = badgeLayer(
    priceId,
    4,
    "Price Badge",
    centerX(width, priceW),
    y,
    priceW,
    priceH,
    "{{price}}",
    { background: "#9a3412", color: "#ffffff", fontSize: Math.round(fb * 0.036), fontWeight: 800, padding: 8 },
  );
  return baseTemplate(preset, "Discount", "#fff7ed", [sale, image, title, price]);
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "product-highlight",
    name: "Product Highlight",
    blurb: "Big product photo with title and price badge.",
    build: buildProductHighlight,
  },
  {
    id: "special-offer",
    name: "Special Offer",
    blurb: "Bold red sale badge on a dark promo backdrop.",
    build: buildSpecialOffer,
  },
  {
    id: "new-arrival",
    name: "New Arrival",
    blurb: "Light, airy card with vendor eyebrow and title.",
    build: buildNewArrival,
  },
  {
    id: "seasonal",
    name: "Seasonal",
    blurb: "Fresh green-tinted panel with price badge.",
    build: buildSeasonal,
  },
  {
    id: "discount",
    name: "Discount",
    blurb: "Warm sale card with discount and price badges.",
    build: buildDiscount,
  },
];
