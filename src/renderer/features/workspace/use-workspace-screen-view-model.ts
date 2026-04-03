import { useEffect, useState } from 'react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import type { AppThemeId, AppThemeOption } from '../../../shared/theme';
import type { VisualMcpSetupStatus } from '../../../shared/mcp-setup-bridge';
import type {
  VisualEmotionPresetId,
  VisualStatePresetId,
} from '../../../shared/visual-presets';
import { getActiveTab, getVisibleTabs } from './model';
import { formatStatusPanelLine } from './status-panel-line';
import { resolveStatusPanelVisual } from './status-panel-visual';
import { useAssistantStatusBridge } from './use-assistant-status-bridge';
import { useAppTheme } from './use-app-theme';
import { useVisualAssetCatalog } from './use-visual-asset-catalog';
import { useWorkspaceState } from './use-workspace-state';
import {
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionMapping,
  setVisualAssetStateLine,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateMapping,
} from './visual-asset-catalog-edits';

const MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY =
  'claude-code-with-emotion:mcp-setup-prompt-dismissed';

function readMcpSetupPromptDismissedPreference(): boolean {
  try {
    return window.localStorage.getItem(MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistMcpSetupPromptDismissedPreference(isDismissed: boolean): void {
  try {
    if (isDismissed) {
      window.localStorage.setItem(
        MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY,
        'true',
      );
      return;
    }

    window.localStorage.removeItem(MCP_SETUP_PROMPT_DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

export interface WorkspaceScreenViewModel {
  activateTab: (tabId: string) => void;
  activeTabId: string;
  availableThemes: AppThemeOption[];
  assistantSnapshot: AssistantStatusSnapshot;
  closeSettingsDialog: () => void;
  closeTab: (tabId: string) => void;
  currentThemeId: AppThemeId;
  createTab: () => void;
  dismissMcpSetupPrompt: () => void;
  handleLaunchClaude: () => void;
  isMcpSetupPromptDismissed: boolean;
  isInstallingVisualMcp: boolean;
  isSettingsDialogOpen: boolean;
  mcpSetupError: string | null;
  mcpSetupStatus: VisualMcpSetupStatus | null;
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
  setStateLine: (statePreset: VisualStatePresetId, line: string) => void;
  statusLine: string;
  statusVisual: ReturnType<typeof resolveStatusPanelVisual>;
  tabs: ReturnType<typeof useWorkspaceState>['state']['tabs'];
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
    source: 'manual' | 'terminal',
  ) => void;
  visualAssetCatalog: ReturnType<typeof useVisualAssetCatalog>['catalog'];
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
  const {
    currentThemeId,
    setThemeId,
    themeOptions,
  } = useAppTheme();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isMcpSetupPromptDismissed, setIsMcpSetupPromptDismissed] = useState(() => {
    return readMcpSetupPromptDismissedPreference();
  });
  const [isInstallingVisualMcp, setIsInstallingVisualMcp] = useState(false);
  const [mcpSetupError, setMcpSetupError] = useState<string | null>(null);
  const [mcpSetupStatus, setMcpSetupStatus] = useState<VisualMcpSetupStatus | null>(
    null,
  );
  const [terminalFocusRequestKey, setTerminalFocusRequestKey] = useState(0);
  const activeTab = getActiveTab(state);
  const visibleTabs = getVisibleTabs(state);
  const fallbackAssistantSnapshot: AssistantStatusSnapshot = {
    activityLabel: '작업중',
    emotion: null,
    overlayLine: null,
    state: state.assistantStatus.visualState,
    line: state.assistantStatus.line,
    currentTask: state.assistantStatus.currentTask,
    updatedAtMs: state.assistantStatus.statusSinceMs,
    intensity: 'medium',
    source: 'workspace',
  };
  const assistantSnapshot = useAssistantStatusBridge(
    activeTab?.id ?? 'session-1',
    fallbackAssistantSnapshot,
  );
  const {
    catalog: visualAssetCatalog,
    pickFiles: pickVisualAssetFiles,
    saveCatalog: saveVisualAssetCatalog,
  } = useVisualAssetCatalog();
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

  const persistVisualAssetCatalog = async (
    nextCatalog: Parameters<typeof saveVisualAssetCatalog>[0],
  ): Promise<void> => {
    await saveVisualAssetCatalog(nextCatalog);
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
      data: '\u0015claude\r',
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
          error instanceof Error ? error.message : 'Visual MCP 설치에 실패했습니다.',
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
    createTab,
    dismissMcpSetupPrompt: () => {
      setIsMcpSetupPromptDismissed(true);
      persistMcpSetupPromptDismissedPreference(true);
    },
    handleLaunchClaude,
    isMcpSetupPromptDismissed,
    isInstallingVisualMcp,
    isSettingsDialogOpen,
    installVisualMcp,
    mcpSetupError,
    mcpSetupStatus,
    openSettingsDialog: () => {
      setIsSettingsDialogOpen(true);
    },
    paneSizes: state.paneSizes,
    terminalFocusRequestKey,
    pickVisualAssets: () => {
      void pickVisualAssetFiles().then((pickedFiles) => {
        if (pickedFiles.length === 0) {
          return;
        }

        void persistVisualAssetCatalog(
          mergePickedVisualAssets(visualAssetCatalog, pickedFiles),
        );
      });
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
    setStateLine: (statePreset, line) => {
      void persistVisualAssetCatalog(
        setVisualAssetStateLine(visualAssetCatalog, statePreset, line),
      );
    },
    statusLine,
    statusVisual,
    tabs: state.tabs,
    toggleEmotion: (assetId, emotion, isEnabled) => {
      void persistVisualAssetCatalog(
        setVisualAssetEmotionMapping(
          visualAssetCatalog,
          assetId,
          emotion,
          isEnabled,
        ),
      );
    },
    toggleState: (assetId, statePreset, isEnabled) => {
      void persistVisualAssetCatalog(
        setVisualAssetStateMapping(
          visualAssetCatalog,
          assetId,
          statePreset,
          isEnabled,
        ),
      );
    },
    toggleStateEmotion: (assetId, statePreset, emotion, isEnabled) => {
      void persistVisualAssetCatalog(
        setVisualAssetStateEmotionMapping(
          visualAssetCatalog,
          assetId,
          statePreset,
          emotion,
          isEnabled,
        ),
      );
    },
    updateTabTitle,
    visualAssetCatalog,
    visibleTabs,
  };
}
