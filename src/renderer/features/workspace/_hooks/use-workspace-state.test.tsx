import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useWorkspaceState } from "./use-workspace-state";
import type { OpenDetachedWorkspaceWindowRequest } from "../../../../shared/workspace-window-bridge";

function installWorkspaceWindowBridge(
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => Promise<void>,
): void {
  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      workspaceCwd: "/tmp/claude-code-with-emotion",
      terminals: {
        onExit: vi.fn(() => () => {}),
      },
      workspaceWindows: {
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
    </div>
  );
}

describe("useWorkspaceState", () => {
  afterEach(() => {
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
});
