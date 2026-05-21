import { fireEvent, render, screen } from "@testing-library/react";
import type { VisualMcpSetupOverview } from "../../../../shared/mcp-setup-bridge";
import { VisualAssetManagerDialog } from "./VisualAssetManagerDialog";

function createMcpSetupStatus(
  claudeInstalled = false,
  codexInstalled = false,
): VisualMcpSetupOverview {
  return {
    installed: claudeInstalled,
    stateFilePath: "/tmp/assistant-visual-mcp.json",
    targets: {
      claude: {
        displayName: "Claude Code",
        installed: claudeInstalled,
        stateFilePath: "/tmp/assistant-visual-mcp.json",
        targetId: "claude",
      },
      codex: {
        displayName: "Codex CLI",
        installed: codexInstalled,
        stateFilePath: "/tmp/assistant-visual-mcp.json",
        targetId: "codex",
      },
    },
  };
}

describe("VisualAssetManagerDialog", () => {
  it("switches between general, theme, asset, and message tabs", () => {
    render(
      <VisualAssetManagerDialog
        availableThemes={[
          { id: "current-dark", label: "Current Dark" },
          { id: "gruvbox-light", label: "Gruvbox Light" },
        ]}
        catalog={{
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
          emotionDescriptions: [],
        }}
        currentThemeId="current-dark"
        installingVisualMcpTargetId={null}
        mcpSetupErrorsByTargetId={{}}
        mcpSetupStatus={createMcpSetupStatus()}
        onClose={() => {}}
        onDropFiles={() => {}}
        onInstallVisualMcp={() => {}}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSelectTheme={() => {}}
        onSetDefaultAsset={() => {}}
        onSetEmotionDescription={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Claude Code MCP 설치" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Codex CLI MCP 설치" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "테마" }));

    expect(screen.getByRole("combobox", { name: "App theme" })).toHaveValue(
      "current-dark",
    );

    fireEvent.click(screen.getByRole("tab", { name: "감정 에셋" }));

    expect(
      screen.getByRole("button", { name: "Add Images" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Image drop zone")).toBeInTheDocument();
    expect(screen.getByText("working__happy.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "상태 텍스트" }));

    expect(
      screen.queryByRole("button", { name: "Add Images" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnected 상태 설명 보기" }),
    ).toBeInTheDocument();
  });

  it("imports dropped image files from the asset drop zone", () => {
    const onDropFiles = vi.fn();
    const droppedFile = new File(["image"], "working__happy.png", {
      type: "image/png",
    });

    render(
      <VisualAssetManagerDialog
        availableThemes={[{ id: "current-dark", label: "Current Dark" }]}
        catalog={{
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
          emotionDescriptions: [],
        }}
        currentThemeId="current-dark"
        installingVisualMcpTargetId={null}
        mcpSetupErrorsByTargetId={{}}
        mcpSetupStatus={createMcpSetupStatus()}
        onClose={() => {}}
        onDropFiles={onDropFiles}
        onInstallVisualMcp={() => {}}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSelectTheme={() => {}}
        onSetDefaultAsset={() => {}}
        onSetEmotionDescription={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "감정 에셋" }));
    fireEvent.drop(screen.getByLabelText("Image drop zone"), {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    expect(onDropFiles).toHaveBeenCalledWith([droppedFile]);
  });

  it("installs the selected Visual MCP target from general settings", () => {
    const onInstallVisualMcp = vi.fn();

    render(
      <VisualAssetManagerDialog
        availableThemes={[{ id: "current-dark", label: "Current Dark" }]}
        catalog={{
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
          emotionDescriptions: [],
        }}
        currentThemeId="current-dark"
        installingVisualMcpTargetId={null}
        mcpSetupErrorsByTargetId={{}}
        mcpSetupStatus={createMcpSetupStatus()}
        onClose={() => {}}
        onDropFiles={() => {}}
        onInstallVisualMcp={onInstallVisualMcp}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSelectTheme={() => {}}
        onSetDefaultAsset={() => {}}
        onSetEmotionDescription={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Codex CLI MCP 설치" }));

    expect(onInstallVisualMcp).toHaveBeenCalledWith("codex");
  });

  it("shows the current owner hint on emotion chips owned by another asset", () => {
    render(
      <VisualAssetManagerDialog
        availableThemes={[{ id: "current-dark", label: "Current Dark" }]}
        catalog={{
          version: 1,
          assets: [
            {
              id: "asset-a",
              kind: "image",
              label: "Avatar A",
              path: "/tmp/a.png",
            },
            {
              id: "asset-b",
              kind: "image",
              label: "Avatar B",
              path: "/tmp/b.png",
            },
          ],
          mappings: [{ assetId: "asset-a", emotion: "happy" }],
          stateLines: [],
          emotionDescriptions: [],
        }}
        currentThemeId="current-dark"
        installingVisualMcpTargetId={null}
        mcpSetupErrorsByTargetId={{}}
        mcpSetupStatus={createMcpSetupStatus()}
        onClose={() => {}}
        onDropFiles={() => {}}
        onInstallVisualMcp={() => {}}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSelectTheme={() => {}}
        onSetDefaultAsset={() => {}}
        onSetEmotionDescription={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "감정 에셋" }));

    // details 두 개 (A, B) 다 열어서 chip 을 보이게 만들어요.
    for (const summary of screen.getAllByText("매핑 설정")) {
      fireEvent.click(summary);
    }

    // Avatar B 의 happy chip - 다른 에셋이 점유 중이니 title 에 owner 힌트가 붙어 있어야 대요.
    const chipForBHappy = document
      .getElementById("emotion-asset-b-happy")
      ?.closest("label");

    expect(chipForBHappy).not.toBeNull();
    expect(chipForBHappy?.getAttribute("title") ?? "").toContain(
      "현재 점유: Avatar A",
    );

    // Avatar A 의 happy chip 은 본인이 점유 중이니 owner 힌트가 없어야 함.
    const chipForAHappy = document
      .getElementById("emotion-asset-a-happy")
      ?.closest("label");

    expect(chipForAHappy).not.toBeNull();
    expect(chipForAHappy?.getAttribute("title") ?? "").not.toContain(
      "현재 점유:",
    );
  });

  it("closes when Escape is pressed or the dim overlay is clicked", () => {
    const onClose = vi.fn();

    render(
      <VisualAssetManagerDialog
        availableThemes={[{ id: "current-dark", label: "Current Dark" }]}
        catalog={{
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
          emotionDescriptions: [],
        }}
        currentThemeId="current-dark"
        installingVisualMcpTargetId={null}
        mcpSetupErrorsByTargetId={{}}
        mcpSetupStatus={createMcpSetupStatus()}
        onClose={onClose}
        onDropFiles={() => {}}
        onInstallVisualMcp={() => {}}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSelectTheme={() => {}}
        onSetDefaultAsset={() => {}}
        onSetEmotionDescription={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByLabelText("Settings overlay"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
