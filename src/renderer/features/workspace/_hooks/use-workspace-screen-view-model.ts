import { useEffect, useRef, useState } from "react";
import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import type { AppThemeId, AppThemeOption } from "../../../../shared/theme";
import type { VisualMcpSetupStatus } from "../../../../shared/mcp-setup-bridge";
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import type { VisualAssetCatalog } from "../../../../shared/visual-assets";
import type { VisualAssetPickerFile } from "../../../../shared/visual-assets-bridge";
import { useToast } from "../../toast/ToastProvider";
import { getActiveTab, getVisibleTabs } from "../model";
import { formatStatusPanelLine, resolveStatusPanelVisual } from "../status-panel";
import { useTabNotifications } from "../tabs";
import { useAssistantStatusBridge } from "./use-assistant-status-bridge";
import { useAppTheme } from "./use-app-theme";
import {
  findVisualAssetEmotionOwner,
  findVisualAssetStateEmotionOwner,
  findVisualAssetStateOwner,
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionDescription,
  setVisualAssetEmotionMapping,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateLine,
  setVisualAssetStateMapping,
  useVisualAssetCatalog,
} from "../visual-asset-manager";
import { useWorkspaceState } from "./use-workspace-state";

function findEmotionLabel(emotionId: VisualEmotionPresetId): string {
  return (
    EMOTION_PRESETS.find((preset) => preset.id === emotionId)?.label ??
    emotionId
  );
}

function findStateLabel(stateId: VisualStatePresetId): string {
  return (
    STATE_PRESETS.find((preset) => preset.id === stateId)?.label ?? stateId
  );
}

function findAssetLabel(
  catalog: VisualAssetCatalog,
  assetId: string,
): string {
  return (
    catalog.assets.find((asset) => asset.id === assetId)?.label ?? assetId
  );
}

const MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY =
  "claude-code-with-emotion:mcp-setup-prompt-dismissed";

function readMcpSetupPromptDismissedPreference(): boolean {
  try {
    return (
      window.localStorage.getItem(MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
}

function persistMcpSetupPromptDismissedPreference(isDismissed: boolean): void {
  try {
    if (isDismissed) {
      window.localStorage.setItem(
        MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY,
        "true",
      );
      return;
    }

    window.localStorage.removeItem(MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

function shouldRestoreTerminalFocus(activeElement: Element | null): boolean {
  if (
    activeElement === null ||
    activeElement === document.body ||
    activeElement === document.documentElement
  ) {
    return true;
  }

  if (!(activeElement instanceof HTMLElement)) {
    return true;
  }

  if (activeElement.closest('[role="dialog"]') !== null) {
    return false;
  }

  if (activeElement.isContentEditable) {
    return false;
  }

  return !["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName);
}

export interface WorkspaceScreenViewModel {
  activateTab: (tabId: string) => void;
  activeTabId: string;
  availableThemes: AppThemeOption[];
  assistantSnapshot: AssistantStatusSnapshot;
  closeSettingsDialog: () => void;
  closeTab: (tabId: string) => void;
  dismissNotification: (tabId: string) => void;
  currentThemeId: AppThemeId;
  createTab: () => void;
  dismissMcpSetupPrompt: () => void;
  dropVisualAssets: (files: ReadonlyArray<File>) => void;
  handleLaunchClaude: () => void;
  isMcpSetupPromptDismissed: boolean;
  isInstallingVisualMcp: boolean;
  isSettingsDialogOpen: boolean;
  mcpSetupError: string | null;
  mcpSetupStatus: VisualMcpSetupStatus | null;
  notifiedTabIds: ReadonlySet<string>;
  installVisualMcp: () => void;
  openSettingsDialog: () => void;
  pickVisualAssets: () => void;
  paneSizes: number[];
  terminalFocusRequestKey: number;
  removeAsset: (assetId: string) => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  resizePane: (index: number, deltaRatio: number) => void;
  setThemeId: (themeId: AppThemeId) => void;
  setDefaultAsset: (assetId: string, isDefault: boolean) => void;
  setEmotionDescription: (
    emotion: VisualEmotionPresetId,
    description: string,
  ) => void;
  setStateLine: (statePreset: VisualStatePresetId, line: string) => void;
  statusLine: string;
  statusVisual: ReturnType<typeof resolveStatusPanelVisual>;
  tabs: ReturnType<typeof useWorkspaceState>["state"]["tabs"];
  toggleEmotion: (
    assetId: string,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
  ) => void;
  toggleState: (
    assetId: string,
    statePreset: VisualStatePresetId,
    isEnabled: boolean,
  ) => void;
  toggleStateEmotion: (
    assetId: string,
    statePreset: VisualStatePresetId,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
  ) => void;
  updateTabTitle: (
    tabId: string,
    title: string,
    source: "manual" | "terminal",
  ) => void;
  visualAssetCatalog: ReturnType<typeof useVisualAssetCatalog>["catalog"];
  visibleTabs: ReturnType<typeof getVisibleTabs>;
}

export function useWorkspaceScreenViewModel(): WorkspaceScreenViewModel {
  const {
    activateTab,
    state,
    closeTab,
    createTab,
    reorderTab,
    resizePane,
    updateTabTitle,
  } = useWorkspaceState();
  const { notifiedTabIds, dismissNotification } = useTabNotifications(
    state.tabs,
    state.activeTabId,
  );
  const { currentThemeId, setThemeId, themeOptions } = useAppTheme();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isMcpSetupPromptDismissed, setIsMcpSetupPromptDismissed] = useState(
    () => {
      return readMcpSetupPromptDismissedPreference();
    },
  );
  const [isInstallingVisualMcp, setIsInstallingVisualMcp] = useState(false);
  const [mcpSetupError, setMcpSetupError] = useState<string | null>(null);
  const [mcpSetupStatus, setMcpSetupStatus] =
    useState<VisualMcpSetupStatus | null>(null);
  const [terminalFocusRequestKey, setTerminalFocusRequestKey] = useState(0);
  const activeTab = getActiveTab(state);
  const visibleTabs = getVisibleTabs(state);
  const fallbackAssistantSnapshot: AssistantStatusSnapshot = {
    activityLabel: "작업중",
    emotion: state.assistantStatus.emotion ?? null,
    overlayLine: null,
    state: state.assistantStatus.visualState,
    line: state.assistantStatus.line,
    currentTask: state.assistantStatus.currentTask,
    updatedAtMs: state.assistantStatus.statusSinceMs,
    intensity: "medium",
    source: "workspace",
  };
  const assistantSnapshot = useAssistantStatusBridge(
    activeTab?.id ?? "session-1",
    fallbackAssistantSnapshot,
  );
  const {
    catalog: visualAssetCatalog,
    importFiles: importVisualAssetFiles,
    pickFiles: pickVisualAssetFiles,
    saveCatalog: saveVisualAssetCatalog,
  } = useVisualAssetCatalog();
  const toast = useToast();
  // 토스트 undo 가 클릭대는 시점엔 closure 가 낡아 잇을 수 잇어요. 항상 최신 catalog 를 보게 ref 로 투영.
  const catalogRef = useRef(visualAssetCatalog);
  useEffect(() => {
    catalogRef.current = visualAssetCatalog;
  }, [visualAssetCatalog]);
  const statusVisual = resolveStatusPanelVisual(
    assistantSnapshot,
    visualAssetCatalog,
  );
  const statusLine = formatStatusPanelLine(
    assistantSnapshot,
    visualAssetCatalog,
  );

  useEffect(() => {
    const bridge = window.claudeApp?.mcpSetup;

    if (bridge === undefined) {
      return;
    }

    void bridge.getStatus().then((status) => {
      setMcpSetupStatus(status);
    });
  }, []);

  useEffect(() => {
    let pendingRestoreTimerId: number | null = null;

    const requestTerminalFocusRestore = (): void => {
      if (
        activeTab === null ||
        isSettingsDialogOpen ||
        document.visibilityState === "hidden" ||
        !shouldRestoreTerminalFocus(document.activeElement)
      ) {
        return;
      }

      if (pendingRestoreTimerId !== null) {
        window.clearTimeout(pendingRestoreTimerId);
      }

      pendingRestoreTimerId = window.setTimeout(() => {
        pendingRestoreTimerId = null;

        if (
          document.visibilityState === "hidden" ||
          !shouldRestoreTerminalFocus(document.activeElement)
        ) {
          return;
        }

        setTerminalFocusRequestKey((current) => current + 1);
      }, 0);
    };

    window.addEventListener("focus", requestTerminalFocusRestore);

    return () => {
      window.removeEventListener("focus", requestTerminalFocusRestore);

      if (pendingRestoreTimerId !== null) {
        window.clearTimeout(pendingRestoreTimerId);
      }
    };
  }, [activeTab, isSettingsDialogOpen]);

  const persistVisualAssetCatalog = async (
    nextCatalog: Parameters<typeof saveVisualAssetCatalog>[0],
  ): Promise<void> => {
    await saveVisualAssetCatalog(nextCatalog);
  };

  const importVisualAssets = (
    filesPromise: Promise<ReadonlyArray<VisualAssetPickerFile>>,
  ): void => {
    void filesPromise.then((importedFiles) => {
      if (importedFiles.length === 0) {
        return;
      }

      void persistVisualAssetCatalog(
        mergePickedVisualAssets(visualAssetCatalog, importedFiles),
      );
    });
  };

  const handleLaunchClaude = (): void => {
    if (activeTab === null) {
      return;
    }

    const terminalsBridge = window.claudeApp?.terminals;

    if (terminalsBridge === undefined) {
      return;
    }

    void terminalsBridge.sendInput({
      sessionId: activeTab.id,
      data: "\u0015claude\r",
    });
    setTerminalFocusRequestKey((current) => current + 1);
  };

  const installVisualMcp = (): void => {
    const bridge = window.claudeApp?.mcpSetup;

    if (bridge === undefined) {
      return;
    }

    setIsInstallingVisualMcp(true);
    setMcpSetupError(null);
    void bridge
      .install()
      .then((status) => {
        setMcpSetupStatus(status);
      })
      .catch((error: unknown) => {
        setMcpSetupError(
          error instanceof Error
            ? error.message
            : "Visual MCP 설치에 실패했습니다.",
        );
      })
      .finally(() => {
        setIsInstallingVisualMcp(false);
      });
  };

  return {
    activateTab,
    activeTabId: state.activeTabId,
    availableThemes: themeOptions,
    assistantSnapshot,
    closeSettingsDialog: () => {
      setIsSettingsDialogOpen(false);
    },
    closeTab,
    currentThemeId,
    dismissNotification,
    createTab,
    dismissMcpSetupPrompt: () => {
      setIsMcpSetupPromptDismissed(true);
      persistMcpSetupPromptDismissedPreference(true);
    },
    dropVisualAssets: (files) => {
      // webUtils.getPathForFile는 드랍·파일시스템 출처가 아닌 File에 대해 빈 문자열을 돌려주므로 그런 건 걸러냄
      const bridge = window.claudeApp?.visualAssets;

      if (bridge === undefined) {
        return;
      }

      const filePaths = files.flatMap((file) => {
        const resolvedPath = bridge.getPathForFile(file);
        return resolvedPath.length > 0 ? [resolvedPath] : [];
      });

      if (filePaths.length === 0) {
        return;
      }

      importVisualAssets(importVisualAssetFiles(filePaths));
    },
    handleLaunchClaude,
    isMcpSetupPromptDismissed,
    isInstallingVisualMcp,
    isSettingsDialogOpen,
    installVisualMcp,
    mcpSetupError,
    mcpSetupStatus,
    notifiedTabIds,
    openSettingsDialog: () => {
      setIsSettingsDialogOpen(true);
    },
    paneSizes: state.paneSizes,
    terminalFocusRequestKey,
    pickVisualAssets: () => {
      importVisualAssets(pickVisualAssetFiles());
    },
    removeAsset: (assetId) => {
      void persistVisualAssetCatalog(
        removeVisualAsset(visualAssetCatalog, assetId),
      );
    },
    reorderTab,
    resizePane,
    setThemeId,
    setDefaultAsset: (assetId, isDefault) => {
      void persistVisualAssetCatalog(
        setVisualAssetDefault(visualAssetCatalog, assetId, isDefault),
      );
    },
    setEmotionDescription: (emotion, description) => {
      void persistVisualAssetCatalog(
        setVisualAssetEmotionDescription(
          visualAssetCatalog,
          emotion,
          description,
        ),
      );
    },
    setStateLine: (statePreset, line) => {
      void persistVisualAssetCatalog(
        setVisualAssetStateLine(visualAssetCatalog, statePreset, line),
      );
    },
    statusLine,
    statusVisual,
    tabs: state.tabs,
    toggleEmotion: (assetId, emotion, isEnabled) => {
      const previousOwnerAssetId = isEnabled
        ? findVisualAssetEmotionOwner(visualAssetCatalog, emotion)
        : null;

      void persistVisualAssetCatalog(
        setVisualAssetEmotionMapping(
          visualAssetCatalog,
          assetId,
          emotion,
          isEnabled,
        ),
      );

      if (
        previousOwnerAssetId !== null &&
        previousOwnerAssetId !== assetId
      ) {
        const previousOwnerLabel = findAssetLabel(
          visualAssetCatalog,
          previousOwnerAssetId,
        );
        const newOwnerLabel = findAssetLabel(visualAssetCatalog, assetId);
        const emotionLabel = findEmotionLabel(emotion);

        toast.showToast({
          message: `'${emotionLabel}' 을(를) ${previousOwnerLabel} 에서 ${newOwnerLabel} 로 옮겻어요`,
          tone: "warning",
          action: {
            label: "되돌리기",
            onAction: () => {
              void persistVisualAssetCatalog(
                setVisualAssetEmotionMapping(
                  catalogRef.current,
                  previousOwnerAssetId,
                  emotion,
                  true,
                ),
              );
            },
          },
        });
      }
    },
    toggleState: (assetId, statePreset, isEnabled) => {
      const previousOwnerAssetId = isEnabled
        ? findVisualAssetStateOwner(visualAssetCatalog, statePreset)
        : null;

      void persistVisualAssetCatalog(
        setVisualAssetStateMapping(
          visualAssetCatalog,
          assetId,
          statePreset,
          isEnabled,
        ),
      );

      if (
        previousOwnerAssetId !== null &&
        previousOwnerAssetId !== assetId
      ) {
        const previousOwnerLabel = findAssetLabel(
          visualAssetCatalog,
          previousOwnerAssetId,
        );
        const newOwnerLabel = findAssetLabel(visualAssetCatalog, assetId);
        const stateLabel = findStateLabel(statePreset);

        toast.showToast({
          message: `'${stateLabel}' 을(를) ${previousOwnerLabel} 에서 ${newOwnerLabel} 로 옮겻어요`,
          tone: "warning",
          action: {
            label: "되돌리기",
            onAction: () => {
              void persistVisualAssetCatalog(
                setVisualAssetStateMapping(
                  catalogRef.current,
                  previousOwnerAssetId,
                  statePreset,
                  true,
                ),
              );
            },
          },
        });
      }
    },
    toggleStateEmotion: (assetId, statePreset, emotion, isEnabled) => {
      const previousOwnerAssetId = isEnabled
        ? findVisualAssetStateEmotionOwner(
            visualAssetCatalog,
            statePreset,
            emotion,
          )
        : null;

      void persistVisualAssetCatalog(
        setVisualAssetStateEmotionMapping(
          visualAssetCatalog,
          assetId,
          statePreset,
          emotion,
          isEnabled,
        ),
      );

      if (
        previousOwnerAssetId !== null &&
        previousOwnerAssetId !== assetId
      ) {
        const previousOwnerLabel = findAssetLabel(
          visualAssetCatalog,
          previousOwnerAssetId,
        );
        const newOwnerLabel = findAssetLabel(visualAssetCatalog, assetId);
        const stateLabel = findStateLabel(statePreset);
        const emotionLabel = findEmotionLabel(emotion);

        toast.showToast({
          message: `'${stateLabel} + ${emotionLabel}' 을(를) ${previousOwnerLabel} 에서 ${newOwnerLabel} 로 옮겻어요`,
          tone: "warning",
          action: {
            label: "되돌리기",
            onAction: () => {
              void persistVisualAssetCatalog(
                setVisualAssetStateEmotionMapping(
                  catalogRef.current,
                  previousOwnerAssetId,
                  statePreset,
                  emotion,
                  true,
                ),
              );
            },
          },
        });
      }
    },
    updateTabTitle,
    visualAssetCatalog,
    visibleTabs,
  };
}
