import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AssistantSnapshotsBySessionId,
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
} from "../../../../shared/assistant-status";
import type { AssistantProviderMetadata } from "../../../../shared/assistant-provider";
import type { AppThemeId, AppThemeOption } from "../../../../shared/theme";
import type {
  VisualMcpSetupOverview,
  VisualMcpSetupTargetId,
} from "../../../../shared/mcp-setup-bridge";
import {
  EMOTION_PRESETS,
  getDefaultVisualStateLine,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import type { VisualAssetCatalog } from "../../../../shared/visual-assets";
import type { VisualAssetPickerFile } from "../../../../shared/visual-assets-bridge";
import type { WorkspaceWindowScreenPoint } from "../../../../shared/workspace-window-bridge";
import { useToast } from "../../toast/ToastProvider";
import {
  getAllSessionIds,
  getActiveTab,
  getFocusedSession,
  getTabSessionIds,
  type WorkspaceState,
} from "../model";
import {
  resolveAssistantPresentation,
  type AssistantPresentation,
} from "../status-panel";
import { useTabNotifications } from "../tabs";
import { useAssistantStatusStream } from "./use-assistant-status-stream";
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

function findAssetLabel(catalog: VisualAssetCatalog, assetId: string): string {
  return catalog.assets.find((asset) => asset.id === assetId)?.label ?? assetId;
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

function createAssistantLaunchPendingSnapshot(
  assistantProvider: AssistantProviderMetadata,
  nowMs: number,
): AssistantStatusSnapshot {
  return {
    activityLabel: `${assistantProvider.displayName} 세션 시작하는 중`,
    emotion: null,
    overlayLine: null,
    state: "working",
    line: `${assistantProvider.displayName} 세션 실행 중이에요...!`,
    currentTask: `Running ${assistantProvider.displayName} in the active terminal`,
    updatedAtMs: nowMs,
    intensity: "medium",
    source: "workspace-launch-pending",
  };
}

function createProviderDisconnectedLine(
  assistantProvider: AssistantProviderMetadata,
): string {
  return `${assistantProvider.displayName} 아직 미연결이에요. 준비되면 바로 붙을게요...!`;
}

function resolveProviderAwareAssistantSnapshot(
  snapshot: AssistantStatusSnapshot,
  assistantProvider: AssistantProviderMetadata | undefined,
): AssistantStatusSnapshot {
  if (
    assistantProvider === undefined ||
    assistantProvider.id === "claude" ||
    snapshot.state !== "disconnected" ||
    snapshot.source !== "app"
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    line: createProviderDisconnectedLine(assistantProvider),
    currentTask: `Waiting for ${assistantProvider.displayName} to start`,
  };
}

function resolveProviderAwareAssistantPresentation(
  presentation: AssistantPresentation,
  assistantProvider: AssistantProviderMetadata | undefined,
): AssistantPresentation {
  if (
    assistantProvider === undefined ||
    assistantProvider.id === "claude" ||
    presentation.snapshot.state !== "disconnected"
  ) {
    return presentation;
  }

  const defaultDisconnectedLine = getDefaultVisualStateLine("disconnected");
  const providerDisconnectedLine =
    createProviderDisconnectedLine(assistantProvider);

  if (presentation.line === `(${defaultDisconnectedLine})`) {
    return {
      ...presentation,
      line: `(${providerDisconnectedLine})`,
    };
  }

  if (presentation.line === defaultDisconnectedLine) {
    return {
      ...presentation,
      line: providerDisconnectedLine,
    };
  }

  return presentation;
}

interface CollectAssistantSnapshotsForTabHandoffInput {
  pendingSnapshotsBySessionId: Readonly<AssistantSnapshotsBySessionId>;
  snapshotsBySessionId: Readonly<AssistantSnapshotsBySessionId>;
  state: WorkspaceState;
  tabId: string;
}

function shouldHandoffAssistantSnapshot(
  snapshot: AssistantStatusSnapshot,
): boolean {
  return !(snapshot.source === "app" && snapshot.state === "disconnected");
}

function collectAssistantSnapshotsForTabHandoff({
  pendingSnapshotsBySessionId,
  snapshotsBySessionId,
  state,
  tabId,
}: CollectAssistantSnapshotsForTabHandoffInput):
  | AssistantSnapshotsBySessionId
  | undefined {
  const tab = state.tabs.find((candidateTab) => candidateTab.id === tabId);

  if (tab === undefined) {
    return undefined;
  }

  const snapshotsByDetachedSessionId: AssistantSnapshotsBySessionId = {};

  for (const sessionId of getTabSessionIds(tab)) {
    const snapshot =
      snapshotsBySessionId[sessionId] ?? pendingSnapshotsBySessionId[sessionId];

    if (snapshot !== undefined && shouldHandoffAssistantSnapshot(snapshot)) {
      snapshotsByDetachedSessionId[sessionId] = snapshot;
    }
  }

  return Object.keys(snapshotsByDetachedSessionId).length === 0
    ? undefined
    : snapshotsByDetachedSessionId;
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
  detachTab: (tabId: string, screenPoint?: WorkspaceWindowScreenPoint) => void;
  dismissMcpSetupPrompt: () => void;
  dropVisualAssets: (files: ReadonlyArray<File>) => void;
  handleLaunchAssistant: () => void;
  isMcpSetupPromptDismissed: boolean;
  isInstallingVisualMcp: boolean;
  installingVisualMcpTargetId: VisualMcpSetupTargetId | null;
  isSettingsDialogOpen: boolean;
  mcpSetupError: string | null;
  mcpSetupErrorsByTargetId: Partial<Record<VisualMcpSetupTargetId, string>>;
  mcpSetupStatus: VisualMcpSetupOverview | null;
  notifiedTabIds: ReadonlySet<string>;
  installVisualMcp: (targetId?: VisualMcpSetupTargetId) => void;
  openSettingsDialog: () => void;
  pickVisualAssets: () => void;
  activeTab:
    | ReturnType<typeof useWorkspaceState>["state"]["tabs"][number]
    | null;
  closePane: (paneId: string, sessionId: string) => void;
  focusPane: (paneId: string) => void;
  sessions: ReturnType<typeof useWorkspaceState>["state"]["sessions"];
  terminalFocusRequestKey: number;
  removeAsset: (assetId: string) => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  resizeSplit: (splitId: string, deltaRatio: number) => void;
  setThemeId: (themeId: AppThemeId) => void;
  setDefaultAsset: (assetId: string, isDefault: boolean) => void;
  setEmotionDescription: (
    emotion: VisualEmotionPresetId,
    description: string,
  ) => void;
  setStateLine: (statePreset: VisualStatePresetId, line: string) => void;
  assistantPresentation: ReturnType<typeof resolveAssistantPresentation>;
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
  renameTab: (tabId: string, title: string) => void;
  syncSessionTitle: (sessionId: string, title: string) => void;
  visualAssetCatalog: ReturnType<typeof useVisualAssetCatalog>["catalog"];
}

export function useWorkspaceScreenViewModel(): WorkspaceScreenViewModel {
  const [
    pendingAssistantSnapshotsBySessionId,
    setPendingAssistantSnapshotsBySessionId,
  ] = useState<AssistantSnapshotsBySessionId>(() => {
    return window.claudeApp?.initialAssistantSnapshotsBySessionId ?? {};
  });
  const handleAssistantSnapshotsHandoff = useCallback(
    (snapshotsBySessionId: AssistantSnapshotsBySessionId): void => {
      setPendingAssistantSnapshotsBySessionId((current) => ({
        ...current,
        ...snapshotsBySessionId,
      }));
    },
    [],
  );
  const {
    activateTab,
    closePane,
    state,
    closeTab,
    createTab,
    detachTab,
    focusPane,
    reorderTab,
    resizeSplit,
    renameTab,
    syncSessionTitle,
  } = useWorkspaceState({
    onAssistantSnapshotsHandoff: handleAssistantSnapshotsHandoff,
  });
  const { notifiedTabIds, dismissNotification } = useTabNotifications(
    state.tabs.map((tab) => ({
      id: tab.id,
      notificationSessionId: tab.primarySessionId,
    })),
    state.activeTabId,
  );
  const { currentThemeId, setThemeId, themeOptions } = useAppTheme();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isMcpSetupPromptDismissed, setIsMcpSetupPromptDismissed] = useState(
    () => {
      return readMcpSetupPromptDismissedPreference();
    },
  );
  const [installingVisualMcpTargetId, setInstallingVisualMcpTargetId] =
    useState<VisualMcpSetupTargetId | null>(null);
  const [mcpSetupErrorsByTargetId, setMcpSetupErrorsByTargetId] = useState<
    Partial<Record<VisualMcpSetupTargetId, string>>
  >({});
  const [mcpSetupStatus, setMcpSetupStatus] =
    useState<VisualMcpSetupOverview | null>(null);
  const [terminalFocusRequestKey, setTerminalFocusRequestKey] = useState(0);
  const activeTab = getActiveTab(state);
  const activeSession = getFocusedSession(state);
  const assistantProvider = window.claudeApp?.assistantProvider;
  const fallbackAssistantSnapshot: AssistantStatusSnapshot =
    activeSession !== null
      ? (pendingAssistantSnapshotsBySessionId[activeSession.id] ??
        createDefaultAssistantStatusSnapshot(
          state.assistantStatus.statusSinceMs,
        ))
      : createDefaultAssistantStatusSnapshot(
          state.assistantStatus.statusSinceMs,
        );
  const { activeSnapshot: assistantSnapshot, snapshotsBySessionId } =
    useAssistantStatusStream(
      getAllSessionIds(state),
      activeSession?.id ?? null,
      fallbackAssistantSnapshot,
    );
  const providerAwareAssistantSnapshot = resolveProviderAwareAssistantSnapshot(
    assistantSnapshot,
    assistantProvider,
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
  const assistantPresentation = resolveProviderAwareAssistantPresentation(
    resolveAssistantPresentation(
      providerAwareAssistantSnapshot,
      visualAssetCatalog,
    ),
    assistantProvider,
  );

  useEffect(() => {
    const activeSessionIdSet = new Set(getAllSessionIds(state));

    setPendingAssistantSnapshotsBySessionId((current) => {
      let didChange = false;
      const nextSnapshots: Record<string, AssistantStatusSnapshot> = {};

      for (const [sessionId, snapshot] of Object.entries(current)) {
        if (!activeSessionIdSet.has(sessionId)) {
          didChange = true;
          continue;
        }

        const liveSnapshot = snapshotsBySessionId[sessionId];

        if (
          liveSnapshot !== undefined &&
          liveSnapshot.source !== "workspace-launch-pending"
        ) {
          didChange = true;
          continue;
        }

        nextSnapshots[sessionId] = snapshot;
      }

      return didChange ? nextSnapshots : current;
    });
  }, [snapshotsBySessionId, state]);

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

  const handleLaunchAssistant = (): void => {
    if (activeSession === null) {
      return;
    }

    const terminalsBridge = window.claudeApp?.terminals;

    if (assistantProvider === undefined || terminalsBridge === undefined) {
      return;
    }

    setPendingAssistantSnapshotsBySessionId((current) => ({
      ...current,
      [activeSession.id]: createAssistantLaunchPendingSnapshot(
        assistantProvider,
        Date.now(),
      ),
    }));
    void terminalsBridge.sendInput({
      sessionId: activeSession.id,
      data: `\u0015${assistantProvider.launchCommand}\r`,
    });
    setTerminalFocusRequestKey((current) => current + 1);
  };

  const installVisualMcp = (
    targetId: VisualMcpSetupTargetId = "claude",
  ): void => {
    const bridge = window.claudeApp?.mcpSetup;

    if (bridge === undefined) {
      return;
    }

    setInstallingVisualMcpTargetId(targetId);
    setMcpSetupErrorsByTargetId((current) => {
      const nextErrors = { ...current };

      delete nextErrors[targetId];

      return nextErrors;
    });
    void bridge
      .install({ targetId })
      .then((status) => {
        setMcpSetupStatus(status);
      })
      .catch((error: unknown) => {
        setMcpSetupErrorsByTargetId((current) => ({
          ...current,
          [targetId]:
            error instanceof Error
              ? error.message
              : "Visual MCP 설치에 실패했습니다.",
        }));
      })
      .finally(() => {
        setInstallingVisualMcpTargetId(null);
      });
  };

  const requestDetachTab = (
    tabId: string,
    screenPoint?: WorkspaceWindowScreenPoint,
  ): void => {
    const handoffAssistantSnapshots = collectAssistantSnapshotsForTabHandoff({
      pendingSnapshotsBySessionId: pendingAssistantSnapshotsBySessionId,
      snapshotsBySessionId,
      state,
      tabId,
    });

    void detachTab(tabId, screenPoint, handoffAssistantSnapshots)
      .then((didDetach) => {
        if (!didDetach) {
          toast.showToast({
            message: "마지막 탭은 아직 새 창으로 분리할 수 없어요.",
            tone: "warning",
          });
        }
      })
      .catch((error: unknown) => {
        toast.showToast({
          message:
            error instanceof Error
              ? `탭을 새 창으로 분리하지 못했어요: ${error.message}`
              : "탭을 새 창으로 분리하지 못했어요.",
          tone: "warning",
        });
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
    detachTab: requestDetachTab,
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
    handleLaunchAssistant,
    isMcpSetupPromptDismissed,
    isInstallingVisualMcp: installingVisualMcpTargetId === "claude",
    installingVisualMcpTargetId,
    isSettingsDialogOpen,
    installVisualMcp,
    mcpSetupError: mcpSetupErrorsByTargetId.claude ?? null,
    mcpSetupErrorsByTargetId,
    mcpSetupStatus,
    notifiedTabIds,
    openSettingsDialog: () => {
      setIsSettingsDialogOpen(true);
    },
    activeTab,
    closePane: (paneId, sessionId) => {
      if (activeTab === null) {
        return;
      }

      closePane(activeTab.id, paneId, sessionId);
    },
    focusPane: (paneId) => {
      if (activeTab === null) {
        return;
      }

      focusPane(activeTab.id, paneId);
    },
    sessions: state.sessions,
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
    resizeSplit,
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
    assistantPresentation,
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

      if (previousOwnerAssetId !== null && previousOwnerAssetId !== assetId) {
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

      if (previousOwnerAssetId !== null && previousOwnerAssetId !== assetId) {
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

      if (previousOwnerAssetId !== null && previousOwnerAssetId !== assetId) {
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
    renameTab,
    syncSessionTitle,
    visualAssetCatalog,
  };
}
