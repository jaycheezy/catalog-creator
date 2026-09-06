// PoC fixture seeder for c-external-render-spike (disposable, local only).
// Writes a fixture project + publication snapshot into the /tmp dev stores
// consumed by `next start` with CATALOG_FORGE_ALLOW_LOCAL_STORAGE=true.
// Backs up any existing dev stores and prints restore instructions.
// Usage: node scripts/poc-render-fixture.mjs [seed|restore]
import fs from "node:fs";

const PROJECTS_PATH = "/tmp/catalog-forge-projects.json";
const PUBLICATIONS_PATH = "/tmp/catalog-forge-publications.json";

const RED_DOT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const REMOTE_GIF = "https://cdn.shopify.com/s/images/admin/no-image-large.gif";

function layer(id, type, extra = {}) {
  return {
    id, type, name: id, x: 80, y: 80, w: 920, h: 120,
    rotation: 0, z: 1, visible: true, locked: false, style: {}, ...extra,
  };
}

function placementTemplate(sizeId, width, height, id, revision) {
  return {
    id, name: `PoC ${sizeId}`, sizeId, width, height, background: "#ffffff",
    layers: [
      {
        ...layer("layer_image", "product-image", { y: 80, h: height - 400, style: { background: "#fafaf7", borderRadius: 24, opacity: 1 } }),
        objectFit: "contain",
      },
      {
        ...layer("layer_title", "text", {
          y: height - 290, h: 120, rotation: 8, z: 2,
          style: {
            color: "#1a1a1a", fontSize: 42, fontWeight: 700, fontFamily: "Inter",
            textAlign: "left", lineHeight: 1.4, letterSpacing: 0.03, opacity: 0.85,
            borderWidth: 2, borderColor: "#ff0000", borderRadius: 8,
            shadow: "0 2px 8px rgba(0,0,0,0.3)", padding: 10, textTransform: "uppercase",
          },
          content: "{{title}}",
        }),
      },
      {
        ...layer("layer_price", "badge", {
          y: height - 140, w: 260, h: 64, z: 3,
          style: { background: "#111111", color: "#ffffff", fontSize: 32, fontWeight: 700, borderRadius: 999 },
          content: "{{price}}",
        }),
      },
    ],
    createdAt: 1, updatedAt: 2, revision,
  };
}

const products = [
  {
    id: "POC-RED", source_id: "poc:row:1", title: "PoC Red Dot Product With A Very Long Title For Wrapping",
    description: "A deterministic embedded-image fixture product.", availability: "in stock", condition: "new",
    price: "17.90 EUR", link: "https://shop.example/poc-red", image_link: RED_DOT, brand: "PoC",
    additional_image_link: "", item_group_id: "", google_product_category: "", sale_price: "15.50 EUR", inventory: "",
  },
  {
    id: "POC-GIF", source_id: "poc:row:2", title: "PoC Remote Gif", description: "A remote-image fixture product.",
    availability: "in stock", condition: "new", price: "9.99 USD", link: "https://shop.example/poc-gif",
    image_link: REMOTE_GIF, brand: "PoC", additional_image_link: "", item_group_id: "",
    google_product_category: "", sale_price: "", inventory: "",
  },
];

const sizes = [
  ["1:1", 1080, 1080, "tpl_poc00000001", 3],
  ["4:5", 1080, 1350, "tpl_poc00000002", 2],
  ["9:16", 1080, 1920, "tpl_poc00000003", 2],
  ["1.91:1", 1200, 628, "tpl_poc00000004", 1],
];

const mode = process.argv[2] || "seed";
if (mode === "restore") {
  for (const [path, backup] of [[PROJECTS_PATH, `${PROJECTS_PATH}.pocbak`], [PUBLICATIONS_PATH, `${PUBLICATIONS_PATH}.pocbak`]]) {
    if (fs.existsSync(backup)) {
      fs.renameSync(backup, path);
      console.log(`restored ${path}`);
    } else if (fs.existsSync(path)) {
      fs.unlinkSync(path);
      console.log(`removed PoC file ${path} (no backup existed)`);
    }
  }
  process.exit(0);
}

const templates = Object.fromEntries(sizes.map(([sizeId, w, h, id, rev]) => [sizeId, placementTemplate(sizeId, w, h, id, rev)]));
const project = {
  id: "prj_poclocal0001",
  name: "PoC fixture",
  source: { type: "csv", value: "poc.csv", format: "csv" },
  products,
  template: templates["1:1"],
  placement: "carousel",
  placementTemplates: { "4:5": templates["4:5"], "9:16": templates["9:16"], "1.91:1": templates["1.91:1"] },
  importStatus: { complete: true, totalProducts: 2, totalRows: 2 },
  validation: { status: "needs-review", errorCount: 0, warningCount: 1, importComplete: true, issues: [], currencyCodes: ["EUR", "USD"] },
  createdAt: 1, updatedAt: 2, revision: 5,
};
const record = {
  schemaVersion: 1,
  projectId: project.id,
  active: { ...structuredClone(project), projectId: project.id, projectRevision: 5, publishedAt: Date.now() },
  lastAttempt: { status: "success", attemptedRevision: 5, attemptedAt: Date.now() },
};

for (const [path, backup] of [[PROJECTS_PATH, `${PROJECTS_PATH}.pocbak`], [PUBLICATIONS_PATH, `${PUBLICATIONS_PATH}.pocbak`]]) {
  if (fs.existsSync(path) && !fs.existsSync(backup)) {
    fs.renameSync(path, backup);
    console.log(`backed up ${path}`);
  }
}
const projects = fs.existsSync(PROJECTS_PATH) ? JSON.parse(fs.readFileSync(PROJECTS_PATH, "utf8")) : {};
projects[project.id] = project;
fs.writeFileSync(PROJECTS_PATH, JSON.stringify(projects));
const records = fs.existsSync(PUBLICATIONS_PATH) ? JSON.parse(fs.readFileSync(PUBLICATIONS_PATH, "utf8")) : {};
records[project.id] = record;
fs.writeFileSync(PUBLICATIONS_PATH, JSON.stringify(records));
console.log(`seeded ${project.id} (2 products, 4 placements, published rev 5)`);
console.log("feed: /api/feed?projectId=prj_poclocal0001");
