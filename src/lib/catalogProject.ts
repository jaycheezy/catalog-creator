import type { Template } from "@/editor/types";
import type { FeedRow } from "./facebook";
import type { CatalogValidationResult } from "./catalogValidation";

export type CatalogProjectSource =
  | {
      type: "store";
      value: string;
      platform: "shopify" | "woocommerce";
      currencyCodes: string[];
      currencySource: "shopify-cart" | "woocommerce-api" | "missing";
    }
  | { type: "feed-url"; value: string; format: "csv" | "xml" }
  | { type: "csv"; value: string; format: "csv" };

export type CatalogProject = {
  id: string;
  name: string;
  source: CatalogProjectSource;
  products: FeedRow[];
  template: Template;
  placement: "carousel" | "feed" | "portrait" | "story";
  /**
   * Durable per-placement design snapshots keyed by output size, owned by
   * story c-reliable-placement-exports. Each value is a complete saved
   * `Template` whose `sizeId` matches its key and whose dimensions match the
   * canonical preset. `template` stays the active/backward-compatible view.
   * Absent on projects saved before placement exports landed; readers must
   * use `savedPlacementTemplate` for the migration fallback.
   */
  placementTemplates?: Partial<Record<SizePresetId, Template>>;
  importStatus: {
    complete: boolean;
    totalProducts: number;
    totalRows: number;
    warning?: string;
  };
  /** Optional only for projects saved before validation was introduced. */
  validation?: CatalogValidationResult;
  createdAt: number;
  updatedAt: number;
  /** Monotonic durable-save revision. Missing on projects saved before revisions were introduced. */
  revision?: number;
};

export function newProjectId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `prj_${(crypto as Crypto).randomUUID().replace(/-/g, "")}`;
    }
  } catch {}
  return `prj_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 36);
}

export function sanitizeProjectId(value: unknown): string | null {
  if (typeof value !== "string" || !/^prj_[A-Za-z0-9_-]{12,60}$/.test(value)) return null;
  return value;
}

/**
 * Durable output keys for placement-specific saved templates. UI placements
 * map as: Carousel and Feed use `1:1`, Portrait uses `4:5`, Story uses `9:16`;
 * Landscape uses `1.91:1` in the all-sizes workflow.
 */
export type SizePresetId = "1:1" | "4:5" | "9:16" | "1.91:1";

export const SIZE_PRESET_IDS: SizePresetId[] = ["1:1", "4:5", "9:16", "1.91:1"];

export function isSizePresetId(value: unknown): value is SizePresetId {
  return value === "1:1" || value === "4:5" || value === "9:16" || value === "1.91:1";
}

/**
 * Saved design for one placement. Falls back to the active project template
 * when its `sizeId` matches (migration for projects saved before placement
 * exports); otherwise there is no saved output for that size yet.
 */
export function savedPlacementTemplate(project: CatalogProject, sizeId: SizePresetId): Template | undefined {
  const saved = project.placementTemplates?.[sizeId];
  if (saved) return saved;
  if (project.template.sizeId === sizeId) return project.template;
  return undefined;
}

/**
 * Resolve the template a project feed/render request may use. The active
 * template always resolves; a saved placement template resolves by its own
 * template ID. Unknown IDs resolve to null (callers return 404). Accepts the
 * publication snapshot shape as well as the full draft aggregate.
 */
export function resolveProjectTemplate(
  project: Pick<CatalogProject, "template" | "placementTemplates">,
  templateId: string | null,
): Template | null {
  if (!templateId || templateId === project.template.id) return project.template;
  for (const sizeId of SIZE_PRESET_IDS) {
    const saved = project.placementTemplates?.[sizeId];
    if (saved && saved.id === templateId) return saved;
  }
  return null;
}
