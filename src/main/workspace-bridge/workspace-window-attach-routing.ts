import type {
  AttachWorkspaceStateRequest,
  WorkspaceWindowScreenPoint,
} from "../../shared/workspace-window-bridge";
import { WORKSPACE_WINDOW_CHANNELS } from "../../shared/workspace-window-bridge";

interface WorkspaceWindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AttachableWorkspaceWindow {
  id: number;
  getBounds: () => WorkspaceWindowBounds;
  webContents: {
    send: (channel: string, request: AttachWorkspaceStateRequest) => void;
  };
}

interface RouteAttachWorkspaceStateOptions {
  attachedRequest: AttachWorkspaceStateRequest;
  screenPoint: WorkspaceWindowScreenPoint;
  sourceWindow: AttachableWorkspaceWindow | null;
  workspaceWindows: Iterable<AttachableWorkspaceWindow>;
}

function containsScreenPoint(
  bounds: WorkspaceWindowBounds,
  screenPoint: WorkspaceWindowScreenPoint,
): boolean {
  return (
    screenPoint.x >= bounds.x &&
    screenPoint.x < bounds.x + bounds.width &&
    screenPoint.y >= bounds.y &&
    screenPoint.y < bounds.y + bounds.height
  );
}

function findAttachTargetWindow({
  screenPoint,
  sourceWindow,
  workspaceWindows,
}: Omit<
  RouteAttachWorkspaceStateOptions,
  "attachedRequest"
>): AttachableWorkspaceWindow | null {
  const orderedWorkspaceWindows = Array.from(workspaceWindows).reverse();

  for (const workspaceWindow of orderedWorkspaceWindows) {
    if (workspaceWindow.id === sourceWindow?.id) {
      continue;
    }

    if (containsScreenPoint(workspaceWindow.getBounds(), screenPoint)) {
      return workspaceWindow;
    }
  }

  return null;
}

export function routeAttachWorkspaceStateToWindowAtPoint({
  attachedRequest,
  screenPoint,
  sourceWindow,
  workspaceWindows,
}: RouteAttachWorkspaceStateOptions): boolean {
  const targetWindow = findAttachTargetWindow({
    screenPoint,
    sourceWindow,
    workspaceWindows,
  });

  if (targetWindow === null) {
    return false;
  }

  targetWindow.webContents.send(
    WORKSPACE_WINDOW_CHANNELS.attachState,
    attachedRequest,
  );

  return true;
}
