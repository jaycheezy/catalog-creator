import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogPublicationRecord, PublicationAttempt } from "@/lib/catalogPublication";
import type { StoreBucket } from "@/lib/r2Client";
import { template } from "./fixtures/catalog";

const state = vi.hoisted(() => ({ bucket: null as StoreBucket | null }));

vi.mock("@/lib/durableStorage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/durableStorage")>();
  return { ...original, getTemplatesBucket: vi.fn(async () => state.bucket) };
});

import {
  activatePublicationRecord,
  PublicationWriteConflictError,
  recordPublicationFailure,
} from "@/lib/catalogPublicationStore";

const projectId = "prj_publication_store";

function publication(revision: number, publishedAt = revision): CatalogPublicationRecord {
  return {
    schemaVersion: 1,
    projectId,
    active: {
      schemaVersion: 1,
      projectId,
      projectRevision: revision,
      publishedAt,
      name: "Publication store fixture",
      source: { type: "csv", value: "catalog.csv" },
      products: [],
      validation: {
        status: "ready",
        rowCount: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        currencyCodes: [],
        importComplete: true,
        imageChecks: "verified",
        issues: [],
      },
      template: { ...template, revision: 2 },
      importStatus: { complete: true, totalProducts: 0, totalRows: 0 },
      skipped: { productIds: [], codes: [] },
    },
    lastAttempt: { status: "success", attemptedRevision: revision, attemptedAt: publishedAt },
  };
}

function conditionalBucket(initial: CatalogPublicationRecord | null) {
  let stored = initial ? { record: structuredClone(initial), etag: "etag-1" } : null;
  let version = 1;
  let racingRecord: CatalogPublicationRecord | null = null;
  let puts = 0;
  const bucket: StoreBucket = {
    get: async () => stored ? {
      etag: stored.etag,
      text: async () => JSON.stringify(stored!.record),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(stored!.record)).buffer,
    } : null,
    put: async (_key, body, options) => {
      puts++;
      if (racingRecord) {
        version++;
        stored = { record: structuredClone(racingRecord), etag: `etag-${version}` };
        racingRecord = null;
      }
      const condition = options?.onlyIf;
      if (condition?.etagMatches && condition.etagMatches !== stored?.etag) return false;
      if (condition?.etagDoesNotMatch === "*" && stored) return false;
      version++;
      stored = { record: JSON.parse(String(body)) as CatalogPublicationRecord, etag: `etag-${version}` };
      return true;
    },
    list: async () => [],
  };
  return {
    bucket,
    raceWith(record: CatalogPublicationRecord) { racingRecord = structuredClone(record); },
    record() { return stored?.record ?? null; },
    putCount() { return puts; },
  };
}

beforeEach(() => {
  state.bucket = null;
});

describe("guarded publication record updates", () => {
  it("never lets an older activation replace a newer concurrent publication", async () => {
    const storage = conditionalBucket(publication(2));
    storage.raceWith(publication(4));
    state.bucket = storage.bucket;

    const activation = activatePublicationRecord(publication(3));
    await expect(activation).rejects.toBeInstanceOf(PublicationWriteConflictError);
    await expect(activation).rejects.toMatchObject({
      code: "PUBLICATION_CONFLICT",
      currentRevision: 4,
    });
    expect(storage.record()?.active?.projectRevision).toBe(4);
  });

  it("merges a failed attempt without regressing a newer concurrent publication", async () => {
    const storage = conditionalBucket(publication(2));
    storage.raceWith(publication(4));
    state.bucket = storage.bucket;
    const failed: PublicationAttempt & { status: "failed" } = {
      status: "failed",
      attemptedRevision: 3,
      attemptedAt: 30,
      error: { message: "Invalid draft", code: "VALIDATION_BLOCKED", retryable: false },
    };

    const result = await recordPublicationFailure(projectId, failed);
    expect(result.active?.projectRevision).toBe(4);
    expect(result.lastAttempt?.status).toBe("success");
    expect(storage.record()?.active?.projectRevision).toBe(4);
  });

  it("activates an older successful snapshot without erasing a newer failed attempt", async () => {
    const current = publication(2);
    current.lastAttempt = {
      status: "failed",
      attemptedRevision: 4,
      attemptedAt: 40,
      error: { message: "Invalid newer draft", code: "VALIDATION_BLOCKED", retryable: false },
    };
    const storage = conditionalBucket(current);
    state.bucket = storage.bucket;

    const result = await activatePublicationRecord(publication(3, 30));
    expect(result.active?.projectRevision).toBe(3);
    expect(result.lastAttempt).toMatchObject({ status: "failed", attemptedRevision: 4 });
    expect(storage.record()).toEqual(result);
  });

  it("treats publishing the same saved revision as idempotent", async () => {
    const storage = conditionalBucket(publication(3, 10));
    state.bucket = storage.bucket;
    const result = await activatePublicationRecord(publication(3, 20));
    expect(result.active?.publishedAt).toBe(10);
    expect(storage.putCount()).toBe(0);
  });
});
