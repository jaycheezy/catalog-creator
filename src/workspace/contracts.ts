import { BINDINGS, SIZE_PRESETS, type BindingKey, type Layer, type Template } from "@/editor/types";
import type { CatalogValidationStatus } from "@/lib/catalogValidation";
import type { CatalogProjectSource, SizePresetId } from "@/lib/catalogProject";

export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export type WorkspaceDraftTargetId = "master" | `placement:${SizePresetId}`;

export type WorkspaceSourceSummary = {
  type: "store" | "feed-url" | "csv";
  platform?: "shopify" | "woocommerce";
  format?: "csv" | "xml";
  currencyCodes: string[];
};

export function workspaceSourceSummary(source: CatalogProjectSource): WorkspaceSourceSummary {
  if (source.type === "store") {
    return {
      type: source.type,
      platform: source.platform,
      currencyCodes: [...source.currencyCodes],
    };
  }
  return {
    type: source.type,
    format: source.format,
    currencyCodes: [],
  };
}

export type WorkspacePlacementSummary = {
  sizeId: SizePresetId;
  targetId: WorkspaceDraftTargetId;
  active: boolean;
  open: boolean;
  saved: boolean;
  savedRevision: number | null;
};

export type WorkspaceContextData = {
  busy: {
    loading: boolean;
    saving: boolean;
    publishing: boolean;
  };
  project: {
    name: string;
    source: WorkspaceSourceSummary;
    productCount: number;
    totalProducts: number;
    totalRows: number;
    importComplete: boolean;
    validation: {
      status: CatalogValidationStatus | "unavailable";
      errors: number;
      warnings: number;
      imageChecks: "verified" | "not-run" | "unavailable";
    };
  };
  design: {
    activeTargetId: WorkspaceDraftTargetId;
    activeSizeId: SizePresetId;
    masterSizeId: SizePresetId;
    activeSaved: boolean;
    dirty: boolean;
    savedProjectRevision: number;
    savedTemplateRevision: number | null;
    placements: WorkspacePlacementSummary[];
  };
  view: {
    mode: "canvas" | "all-sizes";
    selectedProductId: string | null;
    selectedLayerId: string | null;
  };
  publication: {
    status: "published" | "not-published" | "unavailable";
    publishedProjectRevision: number | null;
    draftNewer: boolean;
  };
  agent: {
    mutationsAvailable: boolean;
    paused: boolean;
    activityCount: number;
    canUndo: boolean;
  };
  capabilities: {
    tools: string[];
    bindings: BindingKey[];
    styleFields: string[];
    sizePresets: { id: SizePresetId; width: number; height: number }[];
  };
};

export type WorkspaceContextSnapshot = {
  sessionId: string;
  projectId: string;
  draftRevision: number;
  viewRevision: number;
  data: WorkspaceContextData;
};

export type WorkspaceDesignSnapshot = {
  targetId: WorkspaceDraftTargetId;
  template: Template;
};

export type WorkspaceSetViewInput = {
  sessionId: string;
  projectId: string;
  expectedViewRevision: number;
  productId?: string;
  layerId?: string | null;
  panel?: "canvas" | "all-sizes";
};

export type WorkspaceViewChange = {
  productIndex?: number;
  layerId?: string | null;
  panel?: "canvas" | "all-sizes";
};

export type WorkspacePreviewDesignInput = {
  sessionId: string;
  projectId: string;
  expectedDraftRevision: number;
  productIds: string[];
  sizeIds: SizePresetId[];
};

export type WorkspacePreviewCell = {
  sourceId: string;
  sizeId: SizePresetId;
  width: number;
  height: number;
};

export type WorkspaceReviewState = {
  viewId: string;
  capturedDraftRevision: number;
  targetId: WorkspaceDraftTargetId;
  productIds: string[];
  sizeIds: SizePresetId[];
  template: Template;
};

export type WorkspacePreviewDesignResult = {
  viewId: string;
  capturedDraftRevision: number;
  targetId: WorkspaceDraftTargetId;
  cells: WorkspacePreviewCell[];
  surface: "browser-draft";
  persisted: false;
};

export type WorkspaceLayerStylePatch = Partial<Layer["style"]>;

export type WorkspaceDesignEdit =
  | { type: "set-background"; background: string }
  | { type: "add-layer"; layer: Layer }
  | {
      type: "update-layer";
      layerId: string;
      patch: Partial<Pick<Layer, "name" | "content" | "x" | "y" | "w" | "h" | "rotation" | "z" | "visible" | "objectFit">>
        & { style?: WorkspaceLayerStylePatch };
    }
  | { type: "remove-layer"; layerId: string };

export type WorkspaceApplyDesignInput = {
  sessionId: string;
  projectId: string;
  targetId: WorkspaceDraftTargetId;
  expectedDraftRevision: number;
  operationId: string;
  edits: WorkspaceDesignEdit[];
};

export type WorkspaceDesignDiff = {
  editIndex: number;
  type: WorkspaceDesignEdit["type"];
  layerId: string | null;
  fields: string[];
  before: Record<string, unknown> | string | null;
  after: Record<string, unknown> | string | null;
};

export type WorkspaceApplyDesignResult = {
  operationId: string;
  transactionToken: string;
  targetId: WorkspaceDraftTargetId;
  appliedDraftRevision: number;
  changedLayerIds: string[];
  diff: WorkspaceDesignDiff[];
  persisted: false;
};

export type WorkspaceUndoDesignInput = {
  sessionId: string;
  projectId: string;
  expectedDraftRevision: number;
  undoToken: string;
};

export type WorkspaceUndoDesignResult = {
  undoneTransactionToken: string;
  targetId: WorkspaceDraftTargetId;
  restoredLayerIds: string[];
  appliedDraftRevision: number;
  persisted: false;
};

export type WorkspaceAgentActivity = {
  actor: "agent";
  operationId: string;
  transactionToken: string;
  targetId: WorkspaceDraftTargetId;
  changedLayerIds: string[];
  beforeDraftRevision: number;
  afterDraftRevision: number;
  createdAt: number;
  status: "applied" | "undone";
  undoDraftRevision?: number;
  result: WorkspaceApplyDesignResult;
};

export type WorkspaceSuccess<T> = {
  ok: true;
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  sessionId: string;
  projectId: string;
  draftRevision: number;
  viewRevision: number;
  data: T;
  warnings: string[];
};

export type WorkspaceErrorCode =
  | "NO_ACTIVE_PROJECT"
  | "PROJECT_LOADING"
  | "AUTH_REQUIRED"
  | "SESSION_CHANGED"
  | "INVALID_ARGUMENT"
  | "PRODUCT_NOT_FOUND"
  | "LAYER_NOT_FOUND"
  | "REVISION_CONFLICT"
  | "UNSUPPORTED_OPERATION"
  | "UNDO_CONFLICT"
  | "CANCELLED"
  | "INTERNAL_ERROR";

export type WorkspaceFailure = {
  ok: false;
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  sessionId: string;
  projectId: string;
  draftRevision: number;
  viewRevision: number;
  error: { code: WorkspaceErrorCode; message: string; retryable: boolean };
};

export const WORKSPACE_STYLE_FIELDS = [
  "background",
  "color",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "textAlign",
  "lineHeight",
  "letterSpacing",
  "opacity",
  "borderRadius",
  "borderWidth",
  "borderColor",
  "padding",
  "shadow",
  "textTransform",
] as const;

export function workspaceCapabilities(tools: string[]): WorkspaceContextData["capabilities"] {
  return {
    tools,
    bindings: BINDINGS.map(({ key }) => key),
    styleFields: [...WORKSPACE_STYLE_FIELDS],
    sizePresets: SIZE_PRESETS.map(({ id, width, height }) => ({ id: id as SizePresetId, width, height })),
  };
}

export function workspaceSuccess<T>(snapshot: WorkspaceContextSnapshot, data: T): WorkspaceSuccess<T> {
  return {
    ok: true,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    sessionId: snapshot.sessionId,
    projectId: snapshot.projectId,
    draftRevision: snapshot.draftRevision,
    viewRevision: snapshot.viewRevision,
    data,
    warnings: [],
  };
}

export function workspaceFailure(
  snapshot: WorkspaceContextSnapshot,
  code: WorkspaceErrorCode,
  message: string,
  retryable = false,
): WorkspaceFailure {
  return {
    ok: false,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    sessionId: snapshot.sessionId,
    projectId: snapshot.projectId,
    draftRevision: snapshot.draftRevision,
    viewRevision: snapshot.viewRevision,
    error: { code, message, retryable },
  };
}
