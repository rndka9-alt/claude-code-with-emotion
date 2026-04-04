import { fireEvent, render, screen } from "@testing-library/react";
import type { AssistantStatusSnapshot } from "../../../shared/assistant-status";
import { StatusPanel } from "./StatusPanel";
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
  onLaunchClaude: () => {},
  onOpenSettings: () => {},
  statusLine: "(자료를 찾는 중)",
};

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
        assistantStatus={assistantStatus}
        {...defaultProps}
        statusVisual={statusVisual}
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
        assistantStatus={assistantStatus}
        {...defaultProps}
        statusVisual={null}
      />,
    );

    expect(container.querySelector(".status-panel__avatar-orb")).not.toBeNull();
  });

  it("renders a custom line with the current activity label in parentheses", () => {
    render(
      <StatusPanel
        assistantStatus={{
          ...assistantStatus,
          overlayLine: "문제를 좀 더 파볼게요!",
          line: "문제를 좀 더 파볼게요!",
        }}
        {...defaultProps}
        statusLine={"문제를 좀 더 파볼게요!\n(자료를 찾는 중)"}
        statusVisual={null}
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
    render(
      <StatusPanel
        assistantStatus={{
          ...assistantStatus,
          state: "disconnected",
        }}
        {...defaultProps}
        statusVisual={null}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "실행하기",
      }),
    ).toBeInTheDocument();
  });

  it("launches claude when the disconnected portrait is clicked", () => {
    const onLaunchClaude = vi.fn();

    render(
      <StatusPanel
        assistantStatus={{
          ...assistantStatus,
          state: "disconnected",
        }}
        {...defaultProps}
        onLaunchClaude={onLaunchClaude}
        statusVisual={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "실행하기" }));

    expect(onLaunchClaude).toHaveBeenCalledTimes(1);
  });

  it("opens settings from the panel toolbar button", () => {
    const onOpenSettings = vi.fn();

    render(
      <StatusPanel
        assistantStatus={assistantStatus}
        {...defaultProps}
        onOpenSettings={onOpenSettings}
        statusVisual={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows a visual MCP install prompt when setup is missing", () => {
    render(
      <StatusPanel
        assistantStatus={assistantStatus}
        {...defaultProps}
        mcpSetupInstalled={false}
        statusVisual={null}
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
        assistantStatus={assistantStatus}
        {...defaultProps}
        isMcpSetupPromptDismissed={true}
        mcpSetupInstalled={false}
        statusVisual={null}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Visual MCP 설치는 오른쪽 위 스패너 아이콘 설정에서 할 수 있어요.",
    );
  });
});
