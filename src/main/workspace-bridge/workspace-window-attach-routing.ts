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
  // attach 가 성사된 순간 호출된다. 이사한 세션들의 창 소유권 이전처럼
  // 라우팅 결과(대상 창)를 알아야 하는 후속 처리를 붙이는 지점.
  onAttachedToWindow?: (targetWindow: AttachableWorkspaceWindow) => void;
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
  onAttachedToWindow,
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

  // 소유권 이전을 send 보다 먼저 확정한다. 대상 창 렌더러가 attach 를 처리하는 동안
  // 원본 창이 닫혀도(마지막 탭 이사 시 자동 닫힘) 세션이 원본 창 소유로 정리되지 않게.
  onAttachedToWindow?.(targetWindow);
  targetWindow.webContents.send(
    WORKSPACE_WINDOW_CHANNELS.attachState,
    attachedRequest,
  );

  return true;
}
