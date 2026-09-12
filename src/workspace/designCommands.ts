import { BINDINGS, type Layer, type Template } from "@/editor/types";
import { isSizePresetId } from "@/lib/catalogProject";
import {
  WORKSPACE_STYLE_FIELDS,
  type WorkspaceApplyDesignInput,
  type WorkspaceApplyDesignResult,
  type WorkspaceDesignDiff,
  type WorkspaceDesignEdit,
  type WorkspaceDraftTargetId,
  type WorkspaceErrorCode,
  type WorkspaceSetViewInput,
  type WorkspaceUndoDesignInput,
} from "./contracts";

export const MAX_DESIGN_EDITS = 20;
export const MAX_DESIGN_LAYERS = 100;

export type DesignCommandFailure = {
  ok: false;
  error: { code: WorkspaceErrorCode; message: string; retryable: boolean };
};

export type DesignCommandSuccess<T> = { ok: true; data: T };
export type DesignCommandOutcome<T> = DesignCommandSuccess<T> | DesignCommandFailure;

export type ParsedDesignBatch = {
  input: WorkspaceApplyDesignInput;
  signature: string;
};

export type AppliedDesign = {
  template: Template;
  diff: WorkspaceDesignDiff[];
  changedLayerIds: string[];
};

export type WorkspaceDesignHistoryEntry = {
  signature: string;
  result: WorkspaceApplyDesignResult;
  before: Template;
  after: Template;
  createdAt: number;
};

const STYLE_FIELDS = new Set<string>(WORKSPACE_STYLE_FIELDS);
const BINDING_KEYS = new Set<string>(BINDINGS.map(({ key }) => key));
const ADD_LAYER_TYPES = new Set<Layer["type"]>(["text", "shape", "badge"]);
const OBJECT_FITS = new Set<NonNullable<Layer["objectFit"]>>(["contain", "cover", "fill"]);
const TEXT_ALIGNS = new Set<NonNullable<Layer["style"]["textAlign"]>>(["left", "center", "right"]);
const TEXT_TRANSFORMS = new Set<NonNullable<Layer["style"]["textTransform"]>>([
  "none", "uppercase", "lowercase", "capitalize",
]);
const SAFE_COLOR_NAMES = new Set([
  "transparent", "black", "white", "red", "green", "blue", "gray", "grey", "yellow", "orange", "purple", "pink",
]);
const COMMON_IDENTITY_KEYS = new Set(["sessionId", "projectId"]);
const SET_VIEW_KEYS = new Set(["sessionId", "projectId", "expectedViewRevision", "productId", "layerId", "panel"]);
const BATCH_KEYS = new Set(["sessionId", "projectId", "targetId", "expectedDraftRevision", "operationId", "edits"]);
const UNDO_KEYS = new Set(["sessionId", "projectId", "expectedDraftRevision", "undoToken"]);
const ADD_LAYER_KEYS = new Set([
  "id", "type", "name", "x", "y", "w", "h", "rotation", "z", "visible", "style", "content",
]);
const UPDATE_PATCH_KEYS = new Set([
  "name", "content", "x", "y", "w", "h", "rotation", "z", "visible", "style", "objectFit",
]);

function failure(code: WorkspaceErrorCode, message: string, retryable = false): DesignCommandFailure {
  return { ok: false, error: { code, message, retryable } };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === "object" && !Array.isArray(input));
}

function rejectUnknown(input: Record<string, unknown>, allowed: Set<string>, label: string): DesignCommandFailure | null {
  const key = Object.keys(input).find((candidate) => !allowed.has(candidate));
  return key ? failure("INVALID_ARGUMENT", `${label} does not support property ${key}.`) : null;
}

function requiredString(value: unknown, name: string, max: number, pattern?: RegExp): string | DesignCommandFailure {
  if (typeof value !== "string" || !value.trim()) return failure("INVALID_ARGUMENT", `${name} must be a non-empty string.`);
  const result = value.trim();
  if (result.length > max) return failure("INVALID_ARGUMENT", `${name} is too long.`);
  if (pattern && !pattern.test(result)) return failure("INVALID_ARGUMENT", `${name} contains unsupported characters.`);
  return result;
}

function finiteNumber(
  value: unknown,
  name: string,
  options: { min: number; max: number; integer?: boolean },
): number | DesignCommandFailure {
  if (typeof value !== "number" || !Number.isFinite(value)) return failure("INVALID_ARGUMENT", `${name} must be a finite number.`);
  if (value < options.min || value > options.max || (options.integer && !Number.isInteger(value))) {
    return failure("INVALID_ARGUMENT", `${name} must be between ${options.min} and ${options.max}${options.integer ? " and be an integer" : ""}.`);
  }
  return value;
}

function revision(value: unknown, name: string): number | DesignCommandFailure {
  return finiteNumber(value, name, { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
}

function workspaceIdentity(input: Record<string, unknown>): DesignCommandOutcome<{ sessionId: string; projectId: string }> {
  const sessionId = requiredString(input.sessionId, "sessionId", 100);
  if (typeof sessionId !== "string") return sessionId;
  const projectId = requiredString(input.projectId, "projectId", 100);
  if (typeof projectId !== "string") return projectId;
  return { ok: true, data: { sessionId, projectId } };
}

export function parseDesignReadInput(input: unknown): DesignCommandOutcome<{ sessionId: string; projectId: string }> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", "get_design requires an object input.");
  const extra = rejectUnknown(input, COMMON_IDENTITY_KEYS, "get_design");
  if (extra) return extra;
  return workspaceIdentity(input);
}

export function parseSetViewInput(input: unknown): DesignCommandOutcome<WorkspaceSetViewInput> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", "set_view requires an object input.");
  const extra = rejectUnknown(input, SET_VIEW_KEYS, "set_view");
  if (extra) return extra;
  const identity = workspaceIdentity(input);
  if (!identity.ok) return identity;
  const expectedViewRevision = revision(input.expectedViewRevision, "expectedViewRevision");
  if (typeof expectedViewRevision !== "number") return expectedViewRevision;
  if (!("productId" in input) && !("layerId" in input) && !("panel" in input)) {
    return failure("INVALID_ARGUMENT", "set_view requires productId, layerId, or panel.");
  }

  let productId: string | undefined;
  if ("productId" in input) {
    const parsed = requiredString(input.productId, "productId", 200);
    if (typeof parsed !== "string") return parsed;
    productId = parsed;
  }
  let layerId: string | null | undefined;
  if ("layerId" in input) {
    if (input.layerId === null) layerId = null;
    else {
      const parsed = requiredString(input.layerId, "layerId", 100, /^[A-Za-z0-9_-]+$/);
      if (typeof parsed !== "string") return parsed;
      layerId = parsed;
    }
  }
  let panel: WorkspaceSetViewInput["panel"];
  if ("panel" in input) {
    if (input.panel !== "canvas" && input.panel !== "all-sizes") {
      return failure("INVALID_ARGUMENT", "panel must be canvas or all-sizes.");
    }
    panel = input.panel;
  }
  return { ok: true, data: { ...identity.data, expectedViewRevision, productId, layerId, panel } };
}

function hasUnsafeCss(value: string): boolean {
  return /[;{}<>]|url\s*\(|expression\s*\(|javascript\s*:|@import|var\s*\(/i.test(value);
}

function safePaint(value: unknown, name: string, gradient: boolean): string | DesignCommandFailure {
  const parsed = requiredString(value, name, 200);
  if (typeof parsed !== "string") return parsed;
  if (hasUnsafeCss(parsed)) return failure("UNSUPPORTED_OPERATION", `${name} contains unsupported CSS.`);
  const lower = parsed.toLowerCase();
  if (SAFE_COLOR_NAMES.has(lower)) return parsed;
  if (/^#[0-9a-f]{3,8}$/i.test(parsed)) return parsed;
  if (/^(?:rgb|rgba|hsl|hsla)\([0-9.%+\-,\s]+\)$/i.test(parsed)) return parsed;
  if (gradient && /^(?:linear-gradient|radial-gradient)\([#%(),.\sa-z0-9+\-]+\)$/i.test(parsed)) return parsed;
  return failure("UNSUPPORTED_OPERATION", `${name} must be a supported color${gradient ? " or gradient" : ""}.`);
}

function safePlainText(value: unknown, name: string, max: number): string | DesignCommandFailure {
  if (typeof value !== "string") return failure("INVALID_ARGUMENT", `${name} must be a string.`);
  if (value.length > max) return failure("INVALID_ARGUMENT", `${name} is too long.`);
  if (/[<>]/.test(value)) return failure("UNSUPPORTED_OPERATION", `${name} cannot contain HTML.`);
  return value;
}

function safeContent(value: unknown, name: string): string | DesignCommandFailure {
  const content = safePlainText(value, name, 500);
  if (typeof content !== "string") return content;
  for (const match of content.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
    if (!BINDING_KEYS.has(match[1])) return failure("UNSUPPORTED_OPERATION", `Unsupported binding: ${match[1]}.`);
  }
  const withoutBindings = content.replace(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g, "");
  if (withoutBindings.includes("{{") || withoutBindings.includes("}}")) {
    return failure("INVALID_ARGUMENT", `${name} contains malformed binding syntax.`);
  }
  return content;
}

function safeCssText(value: unknown, name: string, max: number, pattern: RegExp): string | DesignCommandFailure {
  const parsed = requiredString(value, name, max);
  if (typeof parsed !== "string") return parsed;
  if (hasUnsafeCss(parsed) || !pattern.test(parsed)) return failure("UNSUPPORTED_OPERATION", `${name} contains unsupported CSS.`);
  return parsed;
}

function parseStyle(input: unknown, label: string): DesignCommandOutcome<Layer["style"]> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", `${label} must be an object.`);
  const extra = rejectUnknown(input, STYLE_FIELDS, label);
  if (extra) return extra;
  const style: Layer["style"] = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key as keyof Layer["style"]) {
      case "background": {
        const parsed = safePaint(value, `${label}.background`, true);
        if (typeof parsed !== "string") return parsed;
        style.background = parsed;
        break;
      }
      case "color":
      case "borderColor": {
        const parsed = safePaint(value, `${label}.${key}`, false);
        if (typeof parsed !== "string") return parsed;
        if (key === "color") style.color = parsed;
        else style.borderColor = parsed;
        break;
      }
      case "fontSize": {
        const parsed = finiteNumber(value, `${label}.fontSize`, { min: 1, max: 500 });
        if (typeof parsed !== "number") return parsed;
        style.fontSize = parsed;
        break;
      }
      case "fontWeight": {
        const parsed = finiteNumber(value, `${label}.fontWeight`, { min: 100, max: 900, integer: true });
        if (typeof parsed !== "number") return parsed;
        style.fontWeight = parsed;
        break;
      }
      case "lineHeight": {
        const parsed = finiteNumber(value, `${label}.lineHeight`, { min: 0.5, max: 5 });
        if (typeof parsed !== "number") return parsed;
        style.lineHeight = parsed;
        break;
      }
      case "letterSpacing": {
        const parsed = finiteNumber(value, `${label}.letterSpacing`, { min: -1, max: 10 });
        if (typeof parsed !== "number") return parsed;
        style.letterSpacing = parsed;
        break;
      }
      case "opacity": {
        const parsed = finiteNumber(value, `${label}.opacity`, { min: 0, max: 1 });
        if (typeof parsed !== "number") return parsed;
        style.opacity = parsed;
        break;
      }
      case "borderRadius":
      case "padding": {
        const parsed = finiteNumber(value, `${label}.${key}`, { min: 0, max: 2000 });
        if (typeof parsed !== "number") return parsed;
        if (key === "borderRadius") style.borderRadius = parsed;
        else style.padding = parsed;
        break;
      }
      case "borderWidth": {
        const parsed = finiteNumber(value, `${label}.borderWidth`, { min: 0, max: 100 });
        if (typeof parsed !== "number") return parsed;
        style.borderWidth = parsed;
        break;
      }
      case "fontFamily": {
        const parsed = safeCssText(value, `${label}.fontFamily`, 100, /^[A-Za-z0-9 ,'"-]+$/);
        if (typeof parsed !== "string") return parsed;
        style.fontFamily = parsed;
        break;
      }
      case "shadow": {
        const parsed = safeCssText(value, `${label}.shadow`, 200, /^[A-Za-z0-9#(),.%+\-\s]+$/);
        if (typeof parsed !== "string") return parsed;
        style.shadow = parsed;
        break;
      }
      case "textAlign":
        if (typeof value !== "string" || !TEXT_ALIGNS.has(value as NonNullable<Layer["style"]["textAlign"]>)) {
          return failure("INVALID_ARGUMENT", `${label}.textAlign is unsupported.`);
        }
        style.textAlign = value as NonNullable<Layer["style"]["textAlign"]>;
        break;
      case "textTransform":
        if (typeof value !== "string" || !TEXT_TRANSFORMS.has(value as NonNullable<Layer["style"]["textTransform"]>)) {
          return failure("INVALID_ARGUMENT", `${label}.textTransform is unsupported.`);
        }
        style.textTransform = value as NonNullable<Layer["style"]["textTransform"]>;
        break;
    }
  }
  return { ok: true, data: style };
}

function parseLayer(input: unknown, editIndex: number): DesignCommandOutcome<Layer> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", `edits[${editIndex}].layer must be an object.`);
  const extra = rejectUnknown(input, ADD_LAYER_KEYS, `edits[${editIndex}].layer`);
  if (extra) return extra;
  const id = requiredString(input.id, `edits[${editIndex}].layer.id`, 80, /^[A-Za-z0-9_-]+$/);
  if (typeof id !== "string") return id;
  if (typeof input.type !== "string" || !ADD_LAYER_TYPES.has(input.type as Layer["type"])) {
    return failure("INVALID_ARGUMENT", `edits[${editIndex}].layer.type is unsupported.`);
  }
  const type = input.type as Layer["type"];
  const name = requiredString(input.name, `edits[${editIndex}].layer.name`, 100);
  if (typeof name !== "string") return name;
  const geometry = ["x", "y", "w", "h"] as const;
  const parsedGeometry: Record<(typeof geometry)[number], number> = { x: 0, y: 0, w: 0, h: 0 };
  for (const key of geometry) {
    const parsed = finiteNumber(input[key], `edits[${editIndex}].layer.${key}`, {
      min: key === "w" || key === "h" ? 1 : -20000,
      max: 20000,
    });
    if (typeof parsed !== "number") return parsed;
    parsedGeometry[key] = parsed;
  }
  const rotation = input.rotation == null ? 0 : finiteNumber(input.rotation, `edits[${editIndex}].layer.rotation`, { min: -360, max: 360 });
  if (typeof rotation !== "number") return rotation;
  const z = input.z == null ? 1 : finiteNumber(input.z, `edits[${editIndex}].layer.z`, { min: -1000, max: 1000, integer: true });
  if (typeof z !== "number") return z;
  if (input.visible != null && typeof input.visible !== "boolean") {
    return failure("INVALID_ARGUMENT", `edits[${editIndex}].layer.visible must be boolean.`);
  }
  const style = input.style == null ? { ok: true as const, data: {} } : parseStyle(input.style, `edits[${editIndex}].layer.style`);
  if (!style.ok) return style;
  let content: string | undefined;
  if (input.content != null) {
    if (type !== "text" && type !== "badge") return failure("UNSUPPORTED_OPERATION", `Layer type ${type} does not support content.`);
    const parsed = safeContent(input.content, `edits[${editIndex}].layer.content`);
    if (typeof parsed !== "string") return parsed;
    content = parsed;
  }
  return {
    ok: true,
    data: {
      id,
      type,
      name,
      ...parsedGeometry,
      rotation,
      z,
      visible: input.visible ?? true,
      locked: false,
      style: style.data,
      ...(content !== undefined ? { content } : {}),
    },
  };
}

function parseLayerPatch(input: unknown, editIndex: number): DesignCommandOutcome<WorkspaceDesignEdit & { type: "update-layer" }> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", `edits[${editIndex}].patch must be an object.`);
  const extra = rejectUnknown(input, UPDATE_PATCH_KEYS, `edits[${editIndex}].patch`);
  if (extra) return extra;
  if (Object.keys(input).length === 0) return failure("INVALID_ARGUMENT", `edits[${editIndex}].patch cannot be empty.`);
  const patch: Record<string, unknown> = {};
  if ("name" in input) {
    const parsed = requiredString(input.name, `edits[${editIndex}].patch.name`, 100);
    if (typeof parsed !== "string") return parsed;
    patch.name = parsed;
  }
  if ("content" in input) {
    const parsed = safeContent(input.content, `edits[${editIndex}].patch.content`);
    if (typeof parsed !== "string") return parsed;
    patch.content = parsed;
  }
  for (const key of ["x", "y", "w", "h"] as const) {
    if (!(key in input)) continue;
    const parsed = finiteNumber(input[key], `edits[${editIndex}].patch.${key}`, {
      min: key === "w" || key === "h" ? 1 : -20000,
      max: 20000,
    });
    if (typeof parsed !== "number") return parsed;
    patch[key] = parsed;
  }
  if ("rotation" in input) {
    const parsed = finiteNumber(input.rotation, `edits[${editIndex}].patch.rotation`, { min: -360, max: 360 });
    if (typeof parsed !== "number") return parsed;
    patch.rotation = parsed;
  }
  if ("z" in input) {
    const parsed = finiteNumber(input.z, `edits[${editIndex}].patch.z`, { min: -1000, max: 1000, integer: true });
    if (typeof parsed !== "number") return parsed;
    patch.z = parsed;
  }
  if ("visible" in input) {
    if (typeof input.visible !== "boolean") return failure("INVALID_ARGUMENT", `edits[${editIndex}].patch.visible must be boolean.`);
    patch.visible = input.visible;
  }
  if ("objectFit" in input) {
    if (typeof input.objectFit !== "string" || !OBJECT_FITS.has(input.objectFit as NonNullable<Layer["objectFit"]>)) {
      return failure("INVALID_ARGUMENT", `edits[${editIndex}].patch.objectFit is unsupported.`);
    }
    patch.objectFit = input.objectFit;
  }
  if ("style" in input) {
    const parsed = parseStyle(input.style, `edits[${editIndex}].patch.style`);
    if (!parsed.ok) return parsed;
    patch.style = parsed.data;
  }
  return { ok: true, data: { type: "update-layer", layerId: "", patch } as WorkspaceDesignEdit & { type: "update-layer" } };
}

function parseEdit(input: unknown, editIndex: number): DesignCommandOutcome<WorkspaceDesignEdit> {
  if (!isRecord(input) || typeof input.type !== "string") return failure("INVALID_ARGUMENT", `edits[${editIndex}] must name a supported type.`);
  switch (input.type) {
    case "set-background": {
      const extra = rejectUnknown(input, new Set(["type", "background"]), `edits[${editIndex}]`);
      if (extra) return extra;
      const background = safePaint(input.background, `edits[${editIndex}].background`, true);
      return typeof background === "string" ? { ok: true, data: { type: "set-background", background } } : background;
    }
    case "add-layer": {
      const extra = rejectUnknown(input, new Set(["type", "layer"]), `edits[${editIndex}]`);
      if (extra) return extra;
      const layer = parseLayer(input.layer, editIndex);
      return layer.ok ? { ok: true, data: { type: "add-layer", layer: layer.data } } : layer;
    }
    case "update-layer": {
      const extra = rejectUnknown(input, new Set(["type", "layerId", "patch"]), `edits[${editIndex}]`);
      if (extra) return extra;
      const layerId = requiredString(input.layerId, `edits[${editIndex}].layerId`, 80, /^[A-Za-z0-9_-]+$/);
      if (typeof layerId !== "string") return layerId;
      const parsed = parseLayerPatch(input.patch, editIndex);
      return parsed.ok ? { ok: true, data: { ...parsed.data, layerId } } : parsed;
    }
    case "remove-layer": {
      const extra = rejectUnknown(input, new Set(["type", "layerId"]), `edits[${editIndex}]`);
      if (extra) return extra;
      const layerId = requiredString(input.layerId, `edits[${editIndex}].layerId`, 80, /^[A-Za-z0-9_-]+$/);
      return typeof layerId === "string" ? { ok: true, data: { type: "remove-layer", layerId } } : layerId;
    }
    default:
      return failure("UNSUPPORTED_OPERATION", `Unsupported edit type: ${input.type}.`);
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function parseDesignBatchInput(input: unknown): DesignCommandOutcome<ParsedDesignBatch> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", "apply_design_changes requires an object input.");
  const extra = rejectUnknown(input, BATCH_KEYS, "apply_design_changes");
  if (extra) return extra;
  const identity = workspaceIdentity(input);
  if (!identity.ok) return identity;
  const expectedDraftRevision = revision(input.expectedDraftRevision, "expectedDraftRevision");
  if (typeof expectedDraftRevision !== "number") return expectedDraftRevision;
  const operationId = requiredString(input.operationId, "operationId", 100, /^[A-Za-z0-9_.:-]+$/);
  if (typeof operationId !== "string") return operationId;
  let targetId: WorkspaceDraftTargetId;
  if (input.targetId === "master") targetId = "master";
  else if (typeof input.targetId === "string" && input.targetId.startsWith("placement:") && isSizePresetId(input.targetId.slice(10))) {
    targetId = input.targetId as WorkspaceDraftTargetId;
  } else return failure("INVALID_ARGUMENT", "targetId must be master or placement:<supported-size>.");
  if (!Array.isArray(input.edits) || input.edits.length < 1 || input.edits.length > MAX_DESIGN_EDITS) {
    return failure("INVALID_ARGUMENT", `edits must contain 1 to ${MAX_DESIGN_EDITS} entries.`);
  }
  const edits: WorkspaceDesignEdit[] = [];
  for (let index = 0; index < input.edits.length; index++) {
    const parsed = parseEdit(input.edits[index], index);
    if (!parsed.ok) return parsed;
    edits.push(parsed.data);
  }
  const parsedInput: WorkspaceApplyDesignInput = {
    ...identity.data,
    targetId,
    expectedDraftRevision,
    operationId,
    edits,
  };
  return { ok: true, data: { input: parsedInput, signature: JSON.stringify(stableValue(parsedInput)) } };
}

export function parseUndoDesignInput(input: unknown): DesignCommandOutcome<WorkspaceUndoDesignInput> {
  if (!isRecord(input)) return failure("INVALID_ARGUMENT", "undo_design_change requires an object input.");
  const extra = rejectUnknown(input, UNDO_KEYS, "undo_design_change");
  if (extra) return extra;
  const identity = workspaceIdentity(input);
  if (!identity.ok) return identity;
  const expectedDraftRevision = revision(input.expectedDraftRevision, "expectedDraftRevision");
  if (typeof expectedDraftRevision !== "number") return expectedDraftRevision;
  const undoToken = requiredString(input.undoToken, "undoToken", 100, /^txn_[A-Za-z0-9]+$/);
  if (typeof undoToken !== "string") return undoToken;
  return { ok: true, data: { ...identity.data, expectedDraftRevision, undoToken } };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function changedPatch(layer: Layer, patch: WorkspaceDesignEdit & { type: "update-layer" }): { next: Layer; fields: string[]; before: Record<string, unknown>; after: Record<string, unknown> } {
  const next: Layer = { ...layer, style: { ...layer.style } };
  const fields: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch.patch)) {
    if (key === "style") {
      for (const [styleKey, styleValue] of Object.entries(value as Layer["style"])) {
        if (sameValue(layer.style[styleKey as keyof Layer["style"]], styleValue)) continue;
        const field = `style.${styleKey}`;
        fields.push(field);
        before[field] = layer.style[styleKey as keyof Layer["style"]] ?? null;
        after[field] = styleValue;
        Object.assign(next.style, { [styleKey]: styleValue });
      }
      continue;
    }
    if (sameValue(layer[key as keyof Layer], value)) continue;
    fields.push(key);
    before[key] = layer[key as keyof Layer] ?? null;
    after[key] = value;
    Object.assign(next, { [key]: value });
  }
  return { next, fields, before, after };
}

export function applyDesignEdits(template: Template, edits: WorkspaceDesignEdit[]): DesignCommandOutcome<AppliedDesign> {
  const original = structuredClone(template);
  const next = structuredClone(template);
  const diff: WorkspaceDesignDiff[] = [];
  const changedLayerIds = new Set<string>();

  for (let editIndex = 0; editIndex < edits.length; editIndex++) {
    const edit = edits[editIndex];
    if (edit.type === "set-background") {
      if (next.background !== edit.background) {
        diff.push({ editIndex, type: edit.type, layerId: null, fields: ["background"], before: next.background, after: edit.background });
        next.background = edit.background;
      }
      continue;
    }
    if (edit.type === "add-layer") {
      if (next.layers.some(({ id }) => id === edit.layer.id)) return failure("INVALID_ARGUMENT", `Layer ID already exists: ${edit.layer.id}.`);
      if (next.layers.length >= MAX_DESIGN_LAYERS) return failure("INVALID_ARGUMENT", `A design cannot exceed ${MAX_DESIGN_LAYERS} layers.`);
      next.layers.push(structuredClone(edit.layer));
      changedLayerIds.add(edit.layer.id);
      diff.push({ editIndex, type: edit.type, layerId: edit.layer.id, fields: ["layer"], before: null, after: structuredClone(edit.layer) as unknown as Record<string, unknown> });
      continue;
    }
    const index = next.layers.findIndex(({ id }) => id === edit.layerId);
    if (index < 0) return failure("LAYER_NOT_FOUND", `Layer not found: ${edit.layerId}.`);
    const current = next.layers[index];
    if (current.locked) return failure("UNSUPPORTED_OPERATION", `Layer is locked: ${edit.layerId}.`);
    if (edit.type === "remove-layer") {
      next.layers.splice(index, 1);
      changedLayerIds.add(edit.layerId);
      diff.push({ editIndex, type: edit.type, layerId: edit.layerId, fields: ["layer"], before: structuredClone(current) as unknown as Record<string, unknown>, after: null });
      continue;
    }
    if ("content" in edit.patch && current.type !== "text" && current.type !== "badge") {
      return failure("UNSUPPORTED_OPERATION", `Layer type ${current.type} does not support content.`);
    }
    if ("objectFit" in edit.patch && current.type !== "product-image") {
      return failure("UNSUPPORTED_OPERATION", `Layer type ${current.type} does not support objectFit.`);
    }
    const changed = changedPatch(current, edit);
    if (changed.fields.length) {
      next.layers[index] = changed.next;
      changedLayerIds.add(edit.layerId);
      diff.push({ editIndex, type: edit.type, layerId: edit.layerId, fields: changed.fields, before: changed.before, after: changed.after });
    }
  }

  if (diff.length === 0 || sameValue(original, next)) return failure("INVALID_ARGUMENT", "The batch does not change the design.");
  next.updatedAt = Date.now();
  return { ok: true, data: { template: next, diff, changedLayerIds: [...changedLayerIds].sort() } };
}

export function newTransactionToken(): string {
  try {
    if ("randomUUID" in crypto) return `txn_${crypto.randomUUID().replaceAll("-", "")}`;
  } catch {}
  return `txn_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export class WorkspaceDesignHistory {
  private readonly entriesByOperation = new Map<string, WorkspaceDesignHistoryEntry>();
  private readonly order: string[] = [];

  constructor(private readonly limit = 50) {}

  lookup(operationId: string, signature: string): { status: "missing" } | { status: "conflict" } | { status: "match"; entry: WorkspaceDesignHistoryEntry } {
    const entry = this.entriesByOperation.get(operationId);
    if (!entry) return { status: "missing" };
    return entry.signature === signature ? { status: "match", entry: structuredClone(entry) } : { status: "conflict" };
  }

  record(entry: WorkspaceDesignHistoryEntry): void {
    this.entriesByOperation.set(entry.result.operationId, structuredClone(entry));
    this.order.push(entry.result.operationId);
    while (this.order.length > this.limit) {
      const oldest = this.order.shift();
      if (oldest) this.entriesByOperation.delete(oldest);
    }
  }

  list(): WorkspaceDesignHistoryEntry[] {
    return this.order.flatMap((operationId) => {
      const entry = this.entriesByOperation.get(operationId);
      return entry ? [structuredClone(entry)] : [];
    });
  }

  latest(): WorkspaceDesignHistoryEntry | null {
    const operationId = this.order.at(-1);
    const entry = operationId ? this.entriesByOperation.get(operationId) : undefined;
    return entry ? structuredClone(entry) : null;
  }

  prepareUndo(input: {
    undoToken: string;
    expectedDraftRevision: number;
    targetId: WorkspaceDraftTargetId;
    template: Template;
  }): DesignCommandOutcome<{ entry: WorkspaceDesignHistoryEntry; template: Template }> {
    const entry = this.latest();
    if (!entry || entry.result.transactionToken !== input.undoToken) {
      return failure("UNDO_CONFLICT", "That undo point is no longer the latest agent design change.");
    }
    if (
      entry.result.targetId !== input.targetId
      || entry.result.appliedDraftRevision !== input.expectedDraftRevision
      || !sameDesignContent(entry.after, input.template)
    ) {
      return failure("UNDO_CONFLICT", "The design changed after this agent transaction. Undo would overwrite newer work.");
    }
    return {
      ok: true,
      data: {
        entry,
        template: {
          ...structuredClone(entry.before),
          id: input.template.id,
          createdAt: input.template.createdAt,
          updatedAt: Date.now(),
          revision: input.template.revision,
        },
      },
    };
  }

  consumeUndo(undoToken: string): boolean {
    const latest = this.latest();
    if (!latest || latest.result.transactionToken !== undoToken) return false;
    // Undo creates a new branch. Older receipts and snapshots no longer name
    // the immediately preceding state, so release them together.
    this.clear();
    return true;
  }

  clear(): void {
    this.entriesByOperation.clear();
    this.order.splice(0);
  }
}

function sameDesignContent(left: Template, right: Template): boolean {
  const comparable = (template: Template) => {
    const content: Partial<Template> = { ...template };
    delete content.revision;
    delete content.updatedAt;
    return content;
  };
  return sameValue(comparable(left), comparable(right));
}
