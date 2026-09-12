import {
  workspaceFailure,
  type WorkspaceContextSnapshot,
  type WorkspaceDraftTargetId,
  type WorkspaceFailure,
} from "./contracts";

export type WorkspaceActor = "human" | "agent" | "system";

export type WorkspaceRevisionState = {
  draftRevision: number;
  viewRevision: number;
};

export const INITIAL_WORKSPACE_REVISION: WorkspaceRevisionState = {
  draftRevision: 0,
  viewRevision: 0,
};

export type WorkspaceRevisionAction =
  | { type: "draft-changed"; actor: WorkspaceActor }
  | { type: "view-changed"; actor: WorkspaceActor }
  | { type: "reset" };

/**
 * The small shared transition boundary used by editor controls now and agent
 * commands later. Durable project/template revisions remain owned by save APIs.
 */
export function workspaceRevisionReducer(
  state: WorkspaceRevisionState,
  action: WorkspaceRevisionAction,
): WorkspaceRevisionState {
  switch (action.type) {
    case "draft-changed":
      return { ...state, draftRevision: state.draftRevision + 1 };
    case "view-changed":
      return { ...state, viewRevision: state.viewRevision + 1 };
    case "reset":
      return INITIAL_WORKSPACE_REVISION;
  }
}

export type WorkspaceCommandIdentity = {
  sessionId: string;
  projectId: string;
  targetId?: WorkspaceDraftTargetId;
  expectedDraftRevision?: number;
};

export type WorkspaceViewIdentity = {
  sessionId: string;
  projectId: string;
  expectedViewRevision: number;
};

/** Validate a command against the live snapshot before it can change state. */
export function validateWorkspaceCommandIdentity(
  snapshot: WorkspaceContextSnapshot,
  identity: WorkspaceCommandIdentity,
): WorkspaceFailure | null {
  if (identity.sessionId !== snapshot.sessionId || identity.projectId !== snapshot.projectId) {
    return workspaceFailure(snapshot, "SESSION_CHANGED", "The workspace session or project has changed. Refresh context before retrying.");
  }
  if (identity.targetId && identity.targetId !== snapshot.data.design.activeTargetId) {
    return workspaceFailure(snapshot, "REVISION_CONFLICT", "The active design target has changed. Refresh context before retrying.", true);
  }
  if (identity.expectedDraftRevision !== undefined && identity.expectedDraftRevision !== snapshot.draftRevision) {
    return workspaceFailure(snapshot, "REVISION_CONFLICT", "The design draft changed after this command was prepared. Refresh context before retrying.", true);
  }
  return null;
}

export function validateWorkspaceViewIdentity(
  snapshot: WorkspaceContextSnapshot,
  identity: WorkspaceViewIdentity,
): WorkspaceFailure | null {
  const sessionFailure = validateWorkspaceCommandIdentity(snapshot, identity);
  if (sessionFailure) return sessionFailure;
  if (identity.expectedViewRevision !== snapshot.viewRevision) {
    return workspaceFailure(snapshot, "REVISION_CONFLICT", "The workspace view changed after this command was prepared. Refresh context before retrying.", true);
  }
  return null;
}
