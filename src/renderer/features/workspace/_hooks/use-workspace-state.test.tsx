import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useWorkspaceState } from "./use-workspace-state";
import {
  createInitialWorkspaceState,
  detachWorkspaceTab,
  workspaceReducer,
  type DetachedWorkspaceTabResult,
  type WorkspaceState,
  type WorkspaceTab,
} from "../model";
import type {
  AttachWorkspaceStateRequest,
  AttachWorkspaceStateToWindowAtPointRequest,
  OpenDetachedWorkspaceWindowRequest,
} from "../../../../shared/workspace-window-bridge";

let attachWorkspaceStateListener:
  | ((request: AttachWorkspaceStateRequest) => void)
  | null = null;

function getTabAt(state: WorkspaceState, index: number): WorkspaceTab {
  const tab = state.tabs[index];

  if (tab === undefined) {
    throw new Error(`Expected workspace tab at index ${index}`);
  }

  return tab;
}

function getDetachedWorkspaceTabResult(
  result: DetachedWorkspaceTabResult | null,
): DetachedWorkspaceTabResult {
  if (result === null) {
    throw new Error("Expected workspace tab detach result");
  }

  return result;
}

function installWorkspaceWindowBridge(
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => Promise<void>,
  attachWorkspaceStateToWindowAtPoint: (
    request: AttachWorkspaceStateToWindowAtPointRequest,
  ) => Promise<boolean> = vi.fn().mockResolvedValue(false),
  closeCurrentWorkspaceWindow: () => Promise<void> = vi
    .fn()
    .mockResolvedValue(undefined),
): void {
  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      workspaceCwd: "/tmp/claude-code-with-emotion",
      terminals: {
        onExit: vi.fn(() => () => {}),
      },
      workspaceWindows: {
        attachWorkspaceStateToWindowAtPoint,
        closeCurrentWorkspaceWindow,
        onAttachWorkspaceState: vi.fn(
          (listener: (request: AttachWorkspaceStateRequest) => void) => {
            attachWorkspaceStateListener = listener;

            return () => {
              attachWorkspaceStateListener = null;
            };
          },
        ),
        openDetachedWorkspaceWindow,
      },
    },
  });
}

function WorkspaceStateHarness(): ReactElement {
  const { createTab, detachTab, state } = useWorkspaceState();
  const firstTabId = state.tabs[0]?.id ?? "";

  return (
    <div>
      <div data-testid="tab-titles">
        {state.tabs.map((tab) => tab.title).join(",")}
      </div>
      <button onClick={createTab} type="button">
        create
      </button>
      <button
        onClick={() => {
          void detachTab(firstTabId).catch(() => {});
        }}
        type="button"
      >
        detach first
      </button>
      <button
        onClick={() => {
          void detachTab(firstTabId, { x: 500, y: 120 }).catch(() => {});
        }}
        type="button"
      >
        attach first
      </button>
    </div>
  );
}

describe("useWorkspaceState", () => {
  afterEach(() => {
    attachWorkspaceStateListener = null;
    Reflect.deleteProperty(window, "claudeApp");
  });

  it("opens a detached workspace window before replacing the source state", async () => {
    const openDetachedWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
    installWorkspaceWindowBridge(openDetachedWorkspaceWindow);

    render(<WorkspaceStateHarness />);

    fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(screen.getByTestId("tab-titles")).toHaveTextContent(
      "new session 1 · claude-code-with-emotion,new session 2 · claude-code-with-emotion",
    );

    fireEvent.click(screen.getByRole("button", { name: "detach first" }));

    await waitFor(() => {
      expect(openDetachedWorkspaceWindow).toHaveBeenCalledTimes(1);
    });
    expect(openDetachedWorkspaceWindow).toHaveBeenCalledWith({
      initialWorkspaceState: expect.objectContaining({
        activeTabId: expect.any(String),
        tabs: [
          expect.objectContaining({
            title: "new session 1 · claude-code-with-emotion",
          }),
        ],
      }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("tab-titles")).toHaveTextContent(
        "new session 2 · claude-code-with-emotion",
      );
    });
  });

  it("keeps the source state when opening the detached window fails", async () => {
    const openDetachedWorkspaceWindow = vi
      .fn()
      .mockRejectedValue(new Error("window open failed"));
    installWorkspaceWindowBridge(openDetachedWorkspaceWindow);

    render(<WorkspaceStateHarness />);

    fireEvent.click(screen.getByRole("button", { name: "create" }));
    fireEvent.click(screen.getByRole("button", { name: "detach first" }));

    await waitFor(() => {
      expect(openDetachedWorkspaceWindow).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("tab-titles")).toHaveTextContent(
      "new session 1 · claude-code-with-emotion,new session 2 · claude-code-with-emotion",
    );
  });

  it("attaches incoming workspace state from the workspace window bridge", async () => {
    const openDetachedWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
    const detachedSourceState = workspaceReducer(
      createInitialWorkspaceState(20_000),
      {
        type: "createTab",
        nowMs: 20_500,
      },
    );
    const detachedResult = getDetachedWorkspaceTabResult(
      detachWorkspaceTab(
        detachedSourceState,
        getTabAt(detachedSourceState, 1).id,
        21_000,
      ),
    );
    installWorkspaceWindowBridge(openDetachedWorkspaceWindow);

    render(<WorkspaceStateHarness />);

    if (attachWorkspaceStateListener === null) {
      throw new Error("Expected attach workspace state listener to be set.");
    }

    attachWorkspaceStateListener({
      attachedWorkspaceState: detachedResult.detachedState,
    });

    await waitFor(() => {
      expect(screen.getByTestId("tab-titles")).toHaveTextContent(
        "new session 1 · claude-code-with-emotion,new session 2 · claude-code-with-emotion",
      );
    });
  });

  it("removes the source tab when attaching it to another workspace window succeeds", async () => {
    const openDetachedWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
    const attachWorkspaceStateToWindowAtPoint = vi.fn().mockResolvedValue(true);
    installWorkspaceWindowBridge(
      openDetachedWorkspaceWindow,
      attachWorkspaceStateToWindowAtPoint,
    );

    render(<WorkspaceStateHarness />);

    fireEvent.click(screen.getByRole("button", { name: "create" }));
    fireEvent.click(screen.getByRole("button", { name: "attach first" }));

    await waitFor(() => {
      expect(attachWorkspaceStateToWindowAtPoint).toHaveBeenCalledTimes(1);
    });
    expect(attachWorkspaceStateToWindowAtPoint).toHaveBeenCalledWith({
      attachedWorkspaceState: expect.objectContaining({
        tabs: [
          expect.objectContaining({
            title: "new session 1 · claude-code-with-emotion",
          }),
        ],
      }),
      screenPoint: { x: 500, y: 120 },
    });
    expect(openDetachedWorkspaceWindow).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("tab-titles")).toHaveTextContent(
        "new session 2 · claude-code-with-emotion",
      );
    });
  });

  it("closes the source window when attaching its last tab succeeds", async () => {
    const openDetachedWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
    const attachWorkspaceStateToWindowAtPoint = vi.fn().mockResolvedValue(true);
    const closeCurrentWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
    installWorkspaceWindowBridge(
      openDetachedWorkspaceWindow,
      attachWorkspaceStateToWindowAtPoint,
      closeCurrentWorkspaceWindow,
    );

    render(<WorkspaceStateHarness />);

    fireEvent.click(screen.getByRole("button", { name: "attach first" }));

    await waitFor(() => {
      expect(attachWorkspaceStateToWindowAtPoint).toHaveBeenCalledTimes(1);
    });
    expect(closeCurrentWorkspaceWindow).toHaveBeenCalledTimes(1);
    expect(openDetachedWorkspaceWindow).not.toHaveBeenCalled();
  });
});
