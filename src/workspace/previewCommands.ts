import { SIZE_PRESETS, type Template } from "@/editor/types";
import { isSizePresetId, type SizePresetId } from "@/lib/catalogProject";
import type { WorkspaceErrorCode, WorkspacePreviewDesignInput } from "./contracts";

export const MAX_PREVIEW_CELLS = 12;

type PreviewCommandFailure = {
  ok: false;
  error: { code: WorkspaceErrorCode; message: string; retryable: boolean };
};

type PreviewCommandSuccess<T> = { ok: true; data: T };
export type PreviewCommandOutcome<T> = PreviewCommandSuccess<T> | PreviewCommandFailure;

const PREVIEW_KEYS = new Set([
  "sessionId",
  "projectId",
  "expectedDraftRevision",
  "productIds",
  "sizeIds",
]);

function failure(message: string): PreviewCommandFailure {
  return { ok: false, error: { code: "INVALID_ARGUMENT", message, retryable: false } };
}

function requiredString(value: unknown, name: string, max: number): string | PreviewCommandFailure {
  if (typeof value !== "string" || !value.trim()) return failure(`${name} must be a non-empty string.`);
  const result = value.trim();
  return result.length <= max ? result : failure(`${name} is too long.`);
}

function stringList(value: unknown, name: string, maxItems: number): string[] | PreviewCommandFailure {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) {
    return failure(`${name} must contain 1 to ${maxItems} values.`);
  }
  const values: string[] = [];
  for (const item of value) {
    const parsed = requiredString(item, `${name} item`, 200);
    if (typeof parsed !== "string") return parsed;
    if (values.includes(parsed)) return failure(`${name} cannot contain duplicate values.`);
    values.push(parsed);
  }
  return values;
}

export function parsePreviewDesignInput(input: unknown): PreviewCommandOutcome<WorkspacePreviewDesignInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failure("preview_design requires an object input.");
  }
  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).find((key) => !PREVIEW_KEYS.has(key));
  if (unknown) return failure(`preview_design does not support property ${unknown}.`);

  const sessionId = requiredString(record.sessionId, "sessionId", 100);
  if (typeof sessionId !== "string") return sessionId;
  const projectId = requiredString(record.projectId, "projectId", 100);
  if (typeof projectId !== "string") return projectId;
  if (!Number.isSafeInteger(record.expectedDraftRevision) || Number(record.expectedDraftRevision) < 0) {
    return failure("expectedDraftRevision must be a non-negative integer.");
  }
  const productIds = stringList(record.productIds, "productIds", MAX_PREVIEW_CELLS);
  if (!Array.isArray(productIds)) return productIds;
  const parsedSizeIds = stringList(record.sizeIds, "sizeIds", SIZE_PRESETS.length);
  if (!Array.isArray(parsedSizeIds)) return parsedSizeIds;
  const invalidSize = parsedSizeIds.find((sizeId) => !isSizePresetId(sizeId));
  if (invalidSize) return failure(`Unsupported sizeId: ${invalidSize}.`);
  if (productIds.length * parsedSizeIds.length > MAX_PREVIEW_CELLS) {
    return failure(`productIds × sizeIds cannot exceed ${MAX_PREVIEW_CELLS} preview cells.`);
  }

  return {
    ok: true,
    data: {
      sessionId,
      projectId,
      expectedDraftRevision: Number(record.expectedDraftRevision),
      productIds,
      sizeIds: parsedSizeIds as SizePresetId[],
    },
  };
}

export function clonePreviewTemplate(template: Template): Template {
  return {
    ...template,
    layers: template.layers.map((layer) => ({ ...layer, style: { ...layer.style } })),
  };
}

export function newPreviewViewId(): string {
  try {
    if ("randomUUID" in crypto) return `view_${crypto.randomUUID().replace(/-/g, "")}`;
  } catch {}
  return `view_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
