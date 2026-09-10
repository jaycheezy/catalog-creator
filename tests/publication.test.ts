import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as projectGet } from "@/app/api/projects/route";
import { POST as publish } from "@/app/api/projects/publish/route";
import { GET as feed } from "@/app/api/feed/route";
import { GET as render } from "@/app/api/render/route";
import { isAuthenticated } from "@/lib/auth";
import { validateCatalog } from "@/lib/catalogValidation";
import { summarizeSource, type CatalogPublicationRecord } from "@/lib/catalogPublication";
import { mapProductToRows } from "@/lib/facebook";
import { parseFeedCsv } from "@/lib/feedImport";
import { wooProductToRow } from "@/lib/woocommerce";
import { DurableStorageError } from "@/lib/durableStorage";
import type { CatalogProject } from "@/lib/catalogProject";
import { shopifyProduct, template, wooProduct } from "./fixtures/catalog";
import { clearRenderMemoryForTests } from "@/lib/renderCacheStore";

const app = "https://catalog.example";
const projectId = "prj_1234567890abcdef";
const origin = "https://store.example";

let draft: CatalogProject | null = null;
let record: CatalogPublicationRecord | null = null;
let recordWriteError: Error | null = null;
let recordReadError: Error | null = null;
let projectReadError: Error | null = null;
let activationConflictRevision: number | null = null;

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, isAuthenticated: vi.fn(async () => true) };
});
vi.mock("@/lib/catalogProjectStore", () => ({
  saveCatalogProject: vi.fn(),
  getCatalogProject: vi.fn(async () => {
    if (projectReadError) throw projectReadError;
    return draft;
  }),
}));
vi.mock("@/lib/catalogPublicationStore", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/catalogPublicationStore")>();
  return {
    ...original,
    getPublicationRecord: vi.fn(async () => {
      if (recordReadError) throw recordReadError;
      if (recordWriteError) throw recordWriteError;
      return record;
    }),
    savePublicationRecord: vi.fn(async (next: CatalogPublicationRecord) => {
      if (recordWriteError) throw recordWriteError;
      record = structuredClone(next);
    }),
    activatePublicationRecord: vi.fn(async (next: CatalogPublicationRecord) => {
      if (recordWriteError) throw recordWriteError;
      if (activationConflictRevision !== null) {
        throw new original.PublicationWriteConflictError(activationConflictRevision);
      }
      if (record?.active && next.active && record.active.projectRevision >= next.active.projectRevision) return record;
      record = structuredClone(next);
      return record;
    }),
    recordPublicationFailure: vi.fn(async (id: string, attempt: NonNullable<CatalogPublicationRecord["lastAttempt"]>) => {
      if (recordWriteError) throw recordWriteError;
      record = { ...(record ?? { schemaVersion: 1, projectId: id, active: null, lastAttempt: null }), lastAttempt: structuredClone(attempt) };
      return record;
    }),
  };
});
vi.mock("next/og", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return {
    ImageResponse: class extends Response {
      constructor(element: Parameters<typeof renderToStaticMarkup>[0]) {
        super(renderToStaticMarkup(element), { headers: { "Content-Type": "text/html" } });
      }
    },
  };
});

function validProject(): CatalogProject {
  const rows = mapProductToRows(shopifyProduct(), origin, "EUR");
  return {
    id: projectId,
    name: "Fixture",
    source: { type: "store", value: origin, platform: "shopify", currencyCodes: ["EUR"], currencySource: "shopify-cart" },
    products: rows,
    template: { ...template, revision: 2 },
    placement: "carousel",
    importStatus: { complete: true, totalProducts: 1, totalRows: 2 },
    validation: validateCatalog(rows, { importComplete: true }),
    createdAt: 1,
    updatedAt: 1,
    revision: 3,
  };
}

const publishRequest = (body: unknown) =>
  new NextRequest(`${app}/api/projects/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const anonFeed = () => feed(new NextRequest(`${app}/api/feed?projectId=${projectId}`));

beforeEach(() => {
  draft = validProject();
  record = null;
  recordWriteError = null;
  recordReadError = null;
  projectReadError = null;
  activationConflictRevision = null;
  clearRenderMemoryForTests();
  vi.mocked(isAuthenticated).mockResolvedValue(true);
});

describe("project publication endpoint", () => {
  it("publishes the first snapshot with a stable feed URL", async () => {
    const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(response.status).toBe(200);
    const json = await response.json() as {
      feedUrl: string; projectRevision: number; publishedAt: number;
      placements: { sizeId: string }[]; attempt: { status: string };
    };
    expect(json.feedUrl).toBe(`/api/feed?projectId=${projectId}`);
    expect(json.projectRevision).toBe(3);
    expect(json.attempt.status).toBe("success");
    expect(record?.active?.projectRevision).toBe(3);
    expect(record?.active?.products).toHaveLength(2);
  });

  it("requires authentication and an exact saved project revision", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(401);
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const missing = await publish(publishRequest({ id: projectId }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "INVALID_EXPECTED_REVISION", retryable: false });
    const stale = await publish(publishRequest({ id: projectId, expectedRevision: 2 }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "REVISION_CONFLICT" });
    expect(record).toBeNull();
  });

  it("rejects non-canonical saved placement output before activation", async () => {
    draft = { ...validProject(), template: { ...template, sizeId: "banner", width: 900, revision: 2 } };
    const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "INVALID_TEMPLATE", retryable: false });
    expect(record?.active).toBeNull();
    expect(record?.lastAttempt).toMatchObject({ status: "failed", attemptedRevision: 3 });
  });

  it("does not let an older activation replace a concurrently published revision", async () => {
    activationConflictRevision = 4;
    const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PUBLICATION_CONFLICT", revision: 4, retryable: false });
    expect(record).toBeNull();
  });

  it("publishes valid rows while skipping invalid ones with a warning", async () => {
    draft = { ...validProject(), products: [{ ...validProject().products[0], price: "19.95" }, validProject().products[1]] };
    const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(response.status).toBe(200);
    const json = await response.json() as {
      skipped: { productIds: string[]; codes: string[] };
      publishedRows: number;
      totalRows: number;
    };
    expect(json.publishedRows).toBe(1);
    expect(json.totalRows).toBe(2);
    expect(json.skipped.productIds).toEqual(["MUG-SMALL"]);
    expect(json.skipped.codes).toEqual(["invalid-price"]);
    expect(record?.active?.products.map((row) => row.id)).toEqual(["MUG-LARGE"]);
    expect(record?.lastAttempt).toMatchObject({ status: "success", attemptedRevision: 3 });
    // The skipped row never reaches the public feed.
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const csv = await (await anonFeed()).text();
    expect(csv).not.toContain("MUG-SMALL");
    expect(csv).toContain("MUG-LARGE");
  });

  it("rejects a catalog with nothing publishable and incomplete imports", async () => {
    draft = {
      ...validProject(),
      products: validProject().products.map((row) => ({ ...row, price: "broken" })),
    };
    const blocked = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(blocked.status).toBe(422);
    const blockedJson = await blocked.json() as { code: string; error: string };
    expect(blockedJson).toMatchObject({ code: "VALIDATION_BLOCKED" });
    expect(blockedJson.error).toContain("invalid-price");
    expect(blockedJson.error).not.toContain("image-dimensions-unverified");
    expect(record?.active).toBeNull();
    expect(record?.lastAttempt).toMatchObject({ status: "failed", attemptedRevision: 3 });

    draft = { ...validProject(), importStatus: { complete: false, totalProducts: 1, totalRows: 2 } };
    const incomplete = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(incomplete.status).toBe(422);
    expect(await incomplete.json()).toMatchObject({ code: "INCOMPLETE_IMPORT" });
    expect(record?.active).toBeNull();
  });

  it("keeps the prior snapshot when the authoritative write fails", async () => {
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(200);
    const before = await (await anonFeedAsAnonymous()).text();
    recordWriteError = new DurableStorageError("R2 write failed");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const failed = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(failed.status).toBe(503);
    recordWriteError = null;
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    expect(await (await anonFeed()).text()).toBe(before);
  });

  it("returns a retryable 503 when reading the project fails", async () => {
    projectReadError = new DurableStorageError("R2 read failed");
    const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DURABLE_STORAGE_FAILED", retryable: true });
  });

  it("republishes updates through the same stable URL with new immutable images", async () => {
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(200);
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const firstFeed = await anonFeed();
    expect(firstFeed.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    const firstCsv = await firstFeed.text();
    const firstImage = imageLinkFor(firstCsv, "shopify:variant:102");
    const firstPng = await render(new NextRequest(firstImage));
    expect(firstPng.status).toBe(200);
    expect(firstPng.headers.get("X-Render-Cache")).toBe("miss");
    const firstBytes = await firstPng.arrayBuffer();

    draft = { ...validProject(), products: validProject().products.map((row) => ({ ...row })) };
    draft.products[1] = { ...draft.products[1], price: "21.00 EUR" };
    draft.revision = 4;
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 4 }))).status).toBe(200);

    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const secondFeed = await anonFeed();
    expect(secondFeed.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    const secondCsv = await secondFeed.text();
    expect(secondCsv).not.toBe(firstCsv);
    const secondImage = imageLinkFor(secondCsv, "shopify:variant:102");
    expect(secondImage).not.toBe(firstImage);
    // The previous immutable asset survives the republish byte-for-byte.
    const oldPng = await render(new NextRequest(firstImage));
    expect(oldPng.status).toBe(200);
    expect(oldPng.headers.get("X-Render-Cache")).toBe("hit-stale");
    expect(await oldPng.arrayBuffer()).toEqual(firstBytes);
  });

  it("keeps draft-only changes invisible until republish", async () => {
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(200);
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const before = await (await anonFeed()).text();
    draft = { ...validProject(), products: validProject().products.map((row) => ({ ...row, price: "99.00 EUR" })) };
    expect(await (await anonFeed()).text()).toBe(before);
  });

  it("serves drafts to authenticated previews and snapshots to shared links", async () => {
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(200);
    draft = { ...validProject(), products: validProject().products.map((row) => ({ ...row, price: "99.00 EUR" })) };
    const preview = await feed(new NextRequest(`${app}/api/feed?projectId=${projectId}&draft=1`));
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("99.00 EUR");
    // The flag is ignored without authentication: shared links stay public truth.
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const shared = await feed(new NextRequest(`${app}/api/feed?projectId=${projectId}&draft=1`));
    expect(shared.status).toBe(200);
    expect(await shared.text()).not.toContain("99.00 EUR");
  });

  it("returns a stable response for unpublished projects", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    expect((await anonFeed()).status).toBe(404);
    expect((await render(new NextRequest(`${app}/api/render?projectId=${projectId}&templateId=${template.id}&productId=shopify:variant:101`))).status).toBe(404);
  });

  it("restores publication status when reopening the project", async () => {
    expect((await publish(publishRequest({ id: projectId, expectedRevision: 3 }))).status).toBe(200);
    const reopened = await projectGet(new NextRequest(`${app}/api/projects?id=${projectId}`));
    expect(reopened.status).toBe(200);
    const json = await reopened.json() as {
      publication: {
        active: { projectRevision: number; publishedAt: number; publishedRows: number; skippedProductIds: string[] } | null;
        lastAttempt: { status: string } | null;
      };
    };
    expect(json.publication.active?.projectRevision).toBe(3);
    expect(json.publication.active?.publishedRows).toBe(2);
    expect(json.publication.active?.skippedProductIds).toEqual([]);
    expect(json.publication.lastAttempt?.status).toBe("success");
  });

  it("distinguishes an absent publication record from unavailable publication storage", async () => {
    const unpublished = await projectGet(new NextRequest(`${app}/api/projects?id=${projectId}`));
    expect(unpublished.status).toBe(200);
    expect(await unpublished.json()).toMatchObject({ publication: { active: null, lastAttempt: null } });

    recordReadError = new DurableStorageError("R2 read failed");
    const unavailable = await projectGet(new NextRequest(`${app}/api/projects?id=${projectId}`));
    expect(unavailable.status).toBe(200);
    expect(await unavailable.json()).toMatchObject({ publication: null });
  });
});

describe("publication source summary", () => {
  it("does not copy remote-feed credentials into the frozen snapshot", () => {
    expect(summarizeSource({
      type: "feed-url",
      value: "https://feeds.example/private/catalog.csv?token=top-secret#fragment",
      format: "csv",
    })).toEqual({ type: "feed-url", value: "https://feeds.example" });
    expect(summarizeSource({ type: "csv", value: "/Users/alice/private/catalog.csv", format: "csv" }))
      .toEqual({ type: "csv", value: "catalog.csv" });
  });
});

async function anonFeedAsAnonymous() {
  vi.mocked(isAuthenticated).mockResolvedValue(false);
  return anonFeed();
}

function imageLinkFor(csv: string, productId: string): string {
  const rows = parseFeedCsv(csv);
  const row = rows.find((candidate) => new URL(candidate.image_link).searchParams.get("productId") === productId);
  if (!row) throw new Error(`no feed row for ${productId}`);
  return row.image_link;
}

describe("publication across source types", () => {
  it("publishes Shopify, WooCommerce, CSV, and feed-url projects", async () => {
    const base = validProject();
    const variants: { name: string; project: CatalogProject }[] = [
      { name: "shopify", project: base },
      {
        name: "woocommerce",
        project: {
          ...base,
          source: { type: "store", value: origin, platform: "woocommerce", currencyCodes: ["USD"], currencySource: "woocommerce-api" },
          products: [wooProductToRow(wooProduct(), "Fixture")],
        },
      },
      {
        name: "csv",
        project: {
          ...base,
          source: { type: "csv", value: "catalog.csv", format: "csv" },
          products: parseFeedCsv("id,title,description,price,link,image_link,brand,availability,condition\n1,Tea,A complete product description.,10.00 EUR,https://shop.example/tea,https://img.example/tea.jpg,Leaf,in stock,new"),
        },
      },
      {
        name: "feed-url",
        project: {
          ...base,
          source: { type: "feed-url", value: "https://feeds.example/catalog.csv", format: "csv" },
          products: parseFeedCsv("id,title,description,price,link,image_link,brand,availability,condition\n9,Lamp,A complete product description.,20.00 USD,https://shop.example/lamp,https://img.example/lamp.jpg,Beam,in stock,new"),
        },
      },
    ];
    for (const { name, project } of variants) {
      draft = {
        ...project,
        importStatus: { complete: true, totalProducts: project.products.length, totalRows: project.products.length },
        validation: validateCatalog(project.products, { importComplete: true }),
      };
      record = null;
      const response = await publish(publishRequest({ id: projectId, expectedRevision: 3 }));
      expect(response.status, name).toBe(200);
      expect((record as CatalogPublicationRecord | null)?.active?.source.type, name).toBe(project.source.type);
      vi.mocked(isAuthenticated).mockResolvedValue(false);
      expect((await anonFeed()).status, name).toBe(200);
      vi.mocked(isAuthenticated).mockResolvedValue(true);
    }
  });
});
