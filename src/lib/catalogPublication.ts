// Durable publication records for story c-reliable-publish-project.
//
// One record per project holds the last successfully published snapshot plus
// the last attempt result. Anonymous feed/render paths read the active
// snapshot only; saving a draft never changes public output. The project ID
// is already an unguessable capability, so it keys the record directly.

import type { Template } from "@/editor/types";
import type { FeedRow } from "./facebook";
import type { CatalogProject, CatalogProjectSource, SizePresetId } from "./catalogProject";
import type { CatalogValidationResult } from "./catalogValidation";

export const PUBLICATION_SCHEMA_VERSION = 1;
export const PUBLICATION_KEY_PREFIX = "catalog-publications/v1/";

export function publicationKey(projectId: string): string {
  return `${PUBLICATION_KEY_PREFIX}${projectId}.json`;
}

export type PublicationSourceSummary = {
  type: CatalogProjectSource["type"];
  value: string;
  platform?: string;
  currencyCodes?: string[];
};

function safeSourceValue(source: CatalogProjectSource): string {
  if (source.type === "csv") {
    return source.value.split(/[\\/]/).pop()?.replace(/[\r\n\t]/g, " ").slice(0, 200) || "catalog.csv";
  }
  try {
    // Feed URLs can contain signed query parameters. The frozen catalog does
    // not need them, so the publication stores only a display-safe origin.
    return new URL(source.value).origin;
  } catch {
    return "unavailable";
  }
}

export function summarizeSource(source: CatalogProjectSource): PublicationSourceSummary {
  if (source.type === "store") {
    return { type: source.type, value: safeSourceValue(source), platform: source.platform, currencyCodes: source.currencyCodes };
  }
  return { type: source.type, value: safeSourceValue(source) };
}

export type CatalogPublicationSnapshot = {
  schemaVersion: 1;
  projectId: string;
  /** Draft revision that was published. */
  projectRevision: number;
  publishedAt: number;
  /** Project name at publish time, for filenames and reopened UI. */
  name: string;
  source: PublicationSourceSummary;
  /** Normalized catalog frozen at publish time. */
  products: FeedRow[];
  /** Validation verdict frozen at publish time. */
  validation: CatalogValidationResult;
  /** Active template frozen at publish time. */
  template: Template;
  placementTemplates?: Partial<Record<SizePresetId, Template>>;
  importStatus: CatalogProject["importStatus"];
  /** Rows excluded for error-severity issues, with the blocking codes. */
  skipped: { productIds: string[]; codes: string[] };
};

export type PublicationAttempt = {
  status: "success" | "failed";
  attemptedRevision: number;
  attemptedAt: number;
  error?: { message: string; code: string; retryable: boolean };
  /** Rows skipped as invalid on a successful publish. */
  skippedProductIds?: string[];
};

export type CatalogPublicationRecord = {
  schemaVersion: 1;
  projectId: string;
  /** Null until the first successful publication. */
  active: CatalogPublicationSnapshot | null;
  lastAttempt: PublicationAttempt | null;
};

export function blankPublicationRecord(projectId: string): CatalogPublicationRecord {
  return { schemaVersion: PUBLICATION_SCHEMA_VERSION, projectId, active: null, lastAttempt: null };
}

/** Freeze the draft into a publishable snapshot (deep copy, no credentials). */
export function buildPublicationSnapshot(
  project: CatalogProject,
  validation: CatalogValidationResult,
  publishedAt: number,
  skipped: { skippedProductIds: string[]; skippedCodes: string[] } = { skippedProductIds: [], skippedCodes: [] },
): CatalogPublicationSnapshot {
  return {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    projectId: project.id,
    projectRevision: project.revision ?? 0,
    publishedAt,
    name: project.name,
    source: summarizeSource(project.source),
    products: structuredClone(project.products),
    validation: structuredClone(validation),
    template: structuredClone(project.template),
    placementTemplates: project.placementTemplates ? structuredClone(project.placementTemplates) : undefined,
    importStatus: structuredClone(project.importStatus),
    skipped: { productIds: [...skipped.skippedProductIds], codes: [...skipped.skippedCodes] },
  };
}

/** Short public summary for the project response so reload restores status. */
export function publicationSummary(record: CatalogPublicationRecord | null): {
  active: { publishedAt: number; projectRevision: number; publishedRows: number; skippedProductIds: string[] } | null;
  lastAttempt: PublicationAttempt | null;
} {
  if (!record) return { active: null, lastAttempt: null };
  // Older records predate the skipped field; treat them as fully published.
  const skippedProductIds = record.active?.skipped?.productIds ?? [];
  return {
    active: record.active
      ? {
        publishedAt: record.active.publishedAt,
        projectRevision: record.active.projectRevision,
        publishedRows: record.active.products.length,
        skippedProductIds,
      }
      : null,
    lastAttempt: record.lastAttempt,
  };
}
