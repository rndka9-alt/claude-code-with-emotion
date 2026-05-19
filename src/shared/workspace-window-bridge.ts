import { parseWorkspaceState, type WorkspaceState } from "./workspace-state";

export const WORKSPACE_WINDOW_CHANNELS: {
  attachState: string;
  attachToWindowAtPoint: string;
  closeCurrent: string;
  openDetached: string;
} = {
  attachState: "workspace-window:attach-state",
  attachToWindowAtPoint: "workspace-window:attach-to-window-at-point",
  closeCurrent: "workspace-window:close-current",
  openDetached: "workspace-window:open-detached",
};

export interface AttachWorkspaceStateRequest {
  attachedWorkspaceState: WorkspaceState;
}

export interface WorkspaceWindowScreenPoint {
  x: number;
  y: number;
}

export interface AttachWorkspaceStateToWindowAtPointRequest extends AttachWorkspaceStateRequest {
  screenPoint: WorkspaceWindowScreenPoint;
}

export interface OpenDetachedWorkspaceWindowRequest {
  initialWorkspaceState: WorkspaceState;
}

export interface WorkspaceWindowBridge {
  attachWorkspaceStateToWindowAtPoint: (
    request: AttachWorkspaceStateToWindowAtPointRequest,
  ) => Promise<boolean>;
  closeCurrentWorkspaceWindow: () => Promise<void>;
  onAttachWorkspaceState: (
    listener: (request: AttachWorkspaceStateRequest) => void,
  ) => () => void;
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAttachWorkspaceStateRequest(
  value: unknown,
): AttachWorkspaceStateRequest {
  if (!isRecord(value)) {
    throw new Error("Attach workspace state request must be an object.");
  }

  return {
    attachedWorkspaceState: parseWorkspaceState(value.attachedWorkspaceState),
  };
}

function parseWorkspaceWindowScreenPoint(
  value: unknown,
): WorkspaceWindowScreenPoint {
  if (!isRecord(value)) {
    throw new Error("Workspace window screen point must be an object.");
  }

  if (typeof value.x !== "number" || typeof value.y !== "number") {
    throw new Error(
      "Workspace window screen point coordinates must be numbers.",
    );
  }

  return {
    x: value.x,
    y: value.y,
  };
}

export function parseAttachWorkspaceStateToWindowAtPointRequest(
  value: unknown,
): AttachWorkspaceStateToWindowAtPointRequest {
  const attachRequest = parseAttachWorkspaceStateRequest(value);

  if (!isRecord(value)) {
    throw new Error("Attach workspace state request must be an object.");
  }

  return {
    ...attachRequest,
    screenPoint: parseWorkspaceWindowScreenPoint(value.screenPoint),
  };
}

export function parseOpenDetachedWorkspaceWindowRequest(
  value: unknown,
): OpenDetachedWorkspaceWindowRequest {
  if (!isRecord(value)) {
    throw new Error("Detached workspace window request must be an object.");
  }

  return {
    initialWorkspaceState: parseWorkspaceState(value.initialWorkspaceState),
  };
}
