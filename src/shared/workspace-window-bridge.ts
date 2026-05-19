import { parseWorkspaceState, type WorkspaceState } from "./workspace-state";

export const WORKSPACE_WINDOW_CHANNELS: {
  attachState: string;
  attachToWindowAtPoint: string;
  closeCurrent: string;
  openDetached: string;
  hideTabDragPreview: string;
  moveTabDragPreview: string;
  showTabDragPreview: string;
} = {
  attachState: "workspace-window:attach-state",
  attachToWindowAtPoint: "workspace-window:attach-to-window-at-point",
  closeCurrent: "workspace-window:close-current",
  hideTabDragPreview: "workspace-window:hide-tab-drag-preview",
  moveTabDragPreview: "workspace-window:move-tab-drag-preview",
  openDetached: "workspace-window:open-detached",
  showTabDragPreview: "workspace-window:show-tab-drag-preview",
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
  initialScreenPoint?: WorkspaceWindowScreenPoint;
}

export interface WorkspaceTabDragPreviewRequest {
  screenPoint: WorkspaceWindowScreenPoint;
  title: string;
}

export interface WorkspaceTabDragPreviewMoveRequest {
  screenPoint: WorkspaceWindowScreenPoint;
}

export interface WorkspaceWindowBridge {
  attachWorkspaceStateToWindowAtPoint: (
    request: AttachWorkspaceStateToWindowAtPointRequest,
  ) => Promise<boolean>;
  closeCurrentWorkspaceWindow: () => Promise<void>;
  hideTabDragPreview: () => void;
  moveTabDragPreview: (request: WorkspaceTabDragPreviewMoveRequest) => void;
  onAttachWorkspaceState: (
    listener: (request: AttachWorkspaceStateRequest) => void,
  ) => () => void;
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => Promise<void>;
  showTabDragPreview: (request: WorkspaceTabDragPreviewRequest) => void;
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

export function parseWorkspaceWindowScreenPoint(
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

  if (value.initialScreenPoint !== undefined) {
    return {
      initialScreenPoint: parseWorkspaceWindowScreenPoint(
        value.initialScreenPoint,
      ),
      initialWorkspaceState: parseWorkspaceState(value.initialWorkspaceState),
    };
  }

  return {
    initialWorkspaceState: parseWorkspaceState(value.initialWorkspaceState),
  };
}

export function parseWorkspaceTabDragPreviewRequest(
  value: unknown,
): WorkspaceTabDragPreviewRequest {
  if (!isRecord(value)) {
    throw new Error("Workspace tab drag preview request must be an object.");
  }

  if (typeof value.title !== "string") {
    throw new Error("Workspace tab drag preview title must be a string.");
  }

  return {
    screenPoint: parseWorkspaceWindowScreenPoint(value.screenPoint),
    title: value.title,
  };
}

export function parseWorkspaceTabDragPreviewMoveRequest(
  value: unknown,
): WorkspaceTabDragPreviewMoveRequest {
  if (!isRecord(value)) {
    throw new Error(
      "Workspace tab drag preview move request must be an object.",
    );
  }

  return {
    screenPoint: parseWorkspaceWindowScreenPoint(value.screenPoint),
  };
}
