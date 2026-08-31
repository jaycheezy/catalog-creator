export type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const SIZE_PRESETS: SizePreset[] = [
  { id: "1:1", label: "1:1 Feed (1080×1080)", width: 1080, height: 1080 },
  { id: "4:5", label: "4:5 Portrait (1080×1350)", width: 1080, height: 1350 },
  { id: "9:16", label: "9:16 Story (1080×1920)", width: 1080, height: 1920 },
  { id: "1.91:1", label: "1.91:1 Landscape (1200×628)", width: 1200, height: 628 },
];

export type BindingKey =
  | "title"
  | "price"
  | "compare_at_price"
  | "discount_pct"
  | "discount_amount"
  | "vendor"
  | "product_type"
  | "tags"
  | "description"
  | "handle"
  | "sku";

export const BINDINGS: { key: BindingKey; label: string; example: string }[] = [
  { key: "title", label: "Product Title", example: "NOT MY DRAMA" },
  { key: "price", label: "Price (17.90 EUR)", example: "17.90 EUR" },
  { key: "compare_at_price", label: "Compare At Price", example: "22.90 EUR" },
  { key: "discount_pct", label: "Discount % (20% OFF)", example: "20" },
  { key: "discount_amount", label: "Discount Amount", example: "5.00 EUR" },
  { key: "vendor", label: "Vendor / Brand", example: "Gibun Store" },
  { key: "product_type", label: "Product Type", example: "Kräutertee" },
  { key: "tags", label: "Tags", example: "Kräutertee, Bio" },
  { key: "description", label: "Description", example: "Bio Rooibos..." },
  { key: "handle", label: "Handle", example: "notmydrama" },
  { key: "sku", label: "SKU", example: "SEM003-AT-BIO-301" },
];

export type LayerType = "product-image" | "text" | "shape" | "badge";

export type Layer = {
  id: string;
  type: LayerType;
  name: string;
  // position in template coordinates (0..width, 0..height)
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees
  z: number;
  visible: boolean;
  locked: boolean;
  style: {
    background?: string;
    color?: string;
    fontSize?: number; // px at 1080 base
    fontWeight?: number;
    fontFamily?: string;
    textAlign?: "left" | "center" | "right";
    lineHeight?: number;
    letterSpacing?: number; // em
    opacity?: number; // 0..1
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    shadow?: string;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  };
  // content for text/badge — may contain {{binding}} e.g. "{{price}}", "{{discount_pct}}% OFF"
  content?: string;
  // image fit for product-image
  objectFit?: "contain" | "cover" | "fill";
};

export type Template = {
  id: string;
  name: string;
  sizeId: string; // references SIZE_PRESETS
  width: number;
  height: number;
  background: string; // CSS color or gradient
  layers: Layer[];
  createdAt: number;
  updatedAt: number;
};

// AI-friendly JSON schema description for agents
export const TEMPLATE_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "CatalogForgeTemplate",
  description: "HTML overlay template for product catalog creative. Layers are absolute positioned DOM divs. Use {{binding}} syntax for dynamic product fields.",
  type: "object",
  properties: {
    name: { type: "string", description: "Human name, e.g. 'Gibun Premium Frame'" },
    sizeId: { enum: ["1:1", "4:5", "9:16", "1.91:1"] },
    background: { type: "string", description: "CSS background, e.g. '#ffffff' or 'linear-gradient(...)'" },
    layers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { enum: ["product-image", "text", "shape", "badge"] },
          name: { type: "string" },
          x: { type: "number", description: "left px in template coords" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          rotation: { type: "number" },
          content: { type: "string", description: "Text content, may use {{price}}, {{title}}, {{discount_pct}} etc." },
          objectFit: { enum: ["contain", "cover"] },
          style: {
            type: "object",
            properties: {
              background: { type: "string" },
              color: { type: "string" },
              fontSize: { type: "number" },
              fontWeight: { type: "number" },
              fontFamily: { type: "string" },
              textAlign: { enum: ["left", "center", "right"] },
              opacity: { type: "number" },
              borderRadius: { type: "number" },
            },
          },
        },
        required: ["type", "x", "y", "w", "h"],
      },
    },
  },
} as const;

export function createDefaultTemplate(sizeId: string = "1:1"): Template {
  const preset = SIZE_PRESETS.find((s) => s.id === sizeId) ?? SIZE_PRESETS[0];
  const now = Date.now();
  return {
    id: `tpl_${Math.random().toString(36).slice(2, 9)}`,
    name: "Gibun Template 1",
    sizeId: preset.id,
    width: preset.width,
    height: preset.height,
    background: "#ffffff",
    layers: [
      {
        id: "layer_product",
        type: "product-image",
        name: "Product Image",
        x: 80,
        y: 80,
        w: preset.width - 160,
        h: preset.height - 320,
        rotation: 0,
        z: 1,
        visible: true,
        locked: false,
        style: { background: "#fafaf7", borderRadius: 24, opacity: 1 },
        objectFit: "contain",
      },
      {
        id: "layer_title",
        type: "text",
        name: "Title",
        x: 80,
        y: preset.height - 210,
        w: preset.width - 160,
        h: 70,
        rotation: 0,
        z: 2,
        visible: true,
        locked: false,
        style: {
          color: "#1a1a1a",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          lineHeight: 1.1,
          opacity: 1,
        },
        content: "{{title}}",
      },
      {
        id: "layer_price",
        type: "badge",
        name: "Price Badge",
        x: preset.width / 2 - 120,
        y: preset.height - 120,
        w: 240,
        h: 64,
        rotation: 0,
        z: 3,
        visible: true,
        locked: false,
        style: {
          background: "#111111",
          color: "#ffffff",
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          borderRadius: 999,
          opacity: 1,
        },
        content: "{{price}}",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function getPresetById(id: string): SizePreset {
  return SIZE_PRESETS.find((p) => p.id === id) ?? SIZE_PRESETS[0];
}
