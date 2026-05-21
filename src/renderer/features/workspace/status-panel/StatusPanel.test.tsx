import { fireEvent, render, screen } from "@testing-library/react";
import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { StatusPanel } from "./StatusPanel";
import type { AssistantPresentation } from "./assistant-presentation";
import type { StatusPanelVisual } from "./status-panel-visual";

const assistantStatus: AssistantStatusSnapshot = {
  activityLabel: "자료를 찾는 중",
  emotion: null,
  overlayLine: null,
  state: "thinking",
  line: "생각 중이에요...",
  currentTask: "Testing",
  updatedAtMs: 1,
  intensity: "medium",
  source: "test",
};

const defaultProps = {
  isInstallingVisualMcp: false,
  isMcpSetupPromptDismissed: false,
  mcpSetupError: null,
  mcpSetupInstalled: true,
  onDismissMcpSetupPrompt: () => {},
  onInstallVisualMcp: () => {},
  onLaunchAssistant: () => {},
  onOpenSettings: () => {},
};

function createPresentation(
  snapshot: AssistantStatusSnapshot = assistantStatus,
  visual: StatusPanelVisual | null = null,
  line = "(자료를 찾는 중)",
): AssistantPresentation {
  return {
    line,
    snapshot,
    visual,
  };
}

describe("StatusPanel", () => {
  it("renders a mapped visual asset when one exists", () => {
    const statusVisual: StatusPanelVisual = {
      assetUrl: "file:///tmp/thinking.png",
      resolution: {
        asset: {
          id: "asset-thinking",
          kind: "image",
          label: "Thinking Fox",
          path: "/tmp/thinking.png",
        },
        mapping: {
          assetId: "asset-thinking",
          state: "thinking",
        },
        match: "state",
      },
    };

    render(
      <StatusPanel
        {...defaultProps}
        presentation={createPresentation(assistantStatus, statusVisual)}
      />,
    );

    expect(screen.getByRole("img", { name: "Thinking Fox" })).toHaveAttribute(
      "src",
      "file:///tmp/thinking.png",
    );
  });

  it("falls back to the placeholder orb when no asset is mapped", () => {
    const { container } = render(
      <StatusPanel
        {...defaultProps}
        presentation={createPresentation()}
      />,
    );

    expect(container.querySelector(".status-panel__avatar-orb")).not.toBeNull();
  });

  it("renders a custom line with the current activity label in parentheses", () => {
    const snapshot = {
      ...assistantStatus,
      overlayLine: "문제를 좀 더 파볼게요!",
      line: "문제를 좀 더 파볼게요!",
    };

    render(
      <StatusPanel
        {...defaultProps}
        presentation={createPresentation(
          snapshot,
          null,
          "문제를 좀 더 파볼게요!\n(자료를 찾는 중)",
        )}
      />,
    );

    expect(screen.getByText("문제를 좀 더 파볼게요!")).toBeInTheDocument();

    const suffix = screen.getByText((_content, element) => {
      return (
        element?.tagName === "SPAN" &&
        element.classList.contains("opacity-40") &&
        element.textContent === "(자료를 찾는 중)"
      );
    });
    expect(suffix).toBeInTheDocument();
  });

  it("shows a launch button while disconnected", () => {
    const snapshot: AssistantStatusSnapshot = {
      ...assistantStatus,
      state: "disconnected",
    };

    render(
      <StatusPanel
        {...defaultProps}
        presentation={createPresentation(snapshot)}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "실행하기",
      }),
    ).toBeInTheDocument();
  });

  it("launches the assistant when the disconnected portrait is clicked", () => {
    const onLaunchAssistant = vi.fn();

    const snapshot: AssistantStatusSnapshot = {
      ...assistantStatus,
      state: "disconnected",
    };

    render(
      <StatusPanel
        {...defaultProps}
        onLaunchAssistant={onLaunchAssistant}
        presentation={createPresentation(snapshot)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "실행하기" }));

    expect(onLaunchAssistant).toHaveBeenCalledTimes(1);
  });

  it("opens settings from the panel toolbar button", () => {
    const onOpenSettings = vi.fn();

    render(
      <StatusPanel
        {...defaultProps}
        onOpenSettings={onOpenSettings}
        presentation={createPresentation()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows a visual MCP install prompt when setup is missing", () => {
    render(
      <StatusPanel
        {...defaultProps}
        mcpSetupInstalled={false}
        presentation={createPresentation()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Visual MCP 설치" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 묻지 않기" }),
    ).toBeInTheDocument();
  });

  it("shows a settings hint after the MCP prompt is dismissed", () => {
    render(
      <StatusPanel
        {...defaultProps}
        isMcpSetupPromptDismissed={true}
        mcpSetupInstalled={false}
        presentation={createPresentation()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Visual MCP 설치는 오른쪽 위 스패너 아이콘 설정에서 할 수 있어요.",
    );
  });
});
