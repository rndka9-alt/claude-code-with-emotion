import { createDefaultAssistantStatusSnapshot } from "../../shared/assistant-status";
import type { WorkspaceState } from "../../shared/workspace-state";
import {
  type AttachWorkspaceStateRequest,
  WORKSPACE_WINDOW_CHANNELS,
} from "../../shared/workspace-window-bridge";
import {
  routeAttachWorkspaceStateToWindowAtPoint,
  type AttachableWorkspaceWindow,
} from "./workspace-window-attach-routing";

function createWorkspaceState(id: string): WorkspaceState {
  return {
    activeTabId: `tab-${id}`,
    assistantStatus: {
      currentTask: "Testing attach routing",
      line: "Testing attach routing",
      statusSinceMs: 10_000,
      visualState: "completed",
    },
    nextSessionNumber: 2,
    sessions: {
      [`session-${id}`]: {
        command: "",
        createdAtMs: 10_000,
        cwd: "/tmp",
        id: `session-${id}`,
        lifecycle: "ready",
        title: `session-${id}`,
      },
    },
    tabs: [
      {
        focusedPaneId: `pane-${id}`,
        focusedSessionId: `session-${id}`,
        id: `tab-${id}`,
        isManuallyRenamed: false,
        layout: {
          id: `pane-${id}`,
          kind: "pane",
          sessionId: `session-${id}`,
        },
        primarySessionId: `session-${id}`,
        primarySessionTitle: `session-${id}`,
        title: `tab-${id}`,
      },
    ],
  };
}

function createWorkspaceWindow(
  id: number,
  bounds: { height: number; width: number; x: number; y: number },
): AttachableWorkspaceWindow {
  return {
    id,
    getBounds: () => bounds,
    webContents: {
      send: vi.fn(),
    },
  };
}

describe("routeAttachWorkspaceStateToWindowAtPoint", () => {
  it("sends attach state to the workspace window under the screen point", () => {
    const sourceWindow = createWorkspaceWindow(1, {
      height: 300,
      width: 400,
      x: 0,
      y: 0,
    });
    const targetWindow = createWorkspaceWindow(2, {
      height: 300,
      width: 400,
      x: 450,
      y: 0,
    });
    const attachedRequest: AttachWorkspaceStateRequest = {
      assistantSnapshotsBySessionId: {
        "session-attached": {
          ...createDefaultAssistantStatusSnapshot(20_000),
          currentTask: "Testing assistant snapshot handoff",
          source: "assistant-status-test",
          state: "working",
        },
      },
      attachedWorkspaceState: createWorkspaceState("attached"),
    };

    const didRoute = routeAttachWorkspaceStateToWindowAtPoint({
      attachedRequest,
      screenPoint: {
        x: 500,
        y: 120,
      },
      sourceWindow,
      workspaceWindows: [sourceWindow, targetWindow],
    });

    expect(didRoute).toBe(true);
    expect(targetWindow.webContents.send).toHaveBeenCalledWith(
      WORKSPACE_WINDOW_CHANNELS.attachState,
      attachedRequest,
    );
    expect(sourceWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("does not route attach state back to the source window", () => {
    const sourceWindow = createWorkspaceWindow(1, {
      height: 300,
      width: 400,
      x: 0,
      y: 0,
    });

    const didRoute = routeAttachWorkspaceStateToWindowAtPoint({
      attachedRequest: {
        attachedWorkspaceState: createWorkspaceState("attached"),
      },
      screenPoint: {
        x: 100,
        y: 120,
      },
      sourceWindow,
      workspaceWindows: [sourceWindow],
    });

    expect(didRoute).toBe(false);
    expect(sourceWindow.webContents.send).not.toHaveBeenCalled();
  });
});
