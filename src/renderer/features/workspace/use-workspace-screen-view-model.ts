import { useState } from 'react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import type {
  VisualEmotionPresetId,
  VisualStatePresetId,
} from '../../../shared/visual-presets';
import { getActiveTab, getVisibleTabs } from './model';
import { resolveStatusPanelVisual } from './status-panel-visual';
import { useAssistantStatusBridge } from './use-assistant-status-bridge';
import { useVisualAssetCatalog } from './use-visual-asset-catalog';
import { useWorkspaceState } from './use-workspace-state';
import {
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionMapping,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateMapping,
} from './visual-asset-catalog-edits';

export interface WorkspaceScreenViewModel {
  activateTab: (tabId: string) => void;
  activeTabId: string;
  assistantSnapshot: AssistantStatusSnapshot;
  closeAssetManager: () => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  handleLaunchClaude: () => void;
  isVisualAssetManagerOpen: boolean;
  openAssetManager: () => void;
  pickVisualAssets: () => void;
  paneSizes: number[];
  removeAsset: (assetId: string) => void;
  reorderTab: (tabId: string, targetTabId: string) => void;
  resizePane: (index: number, deltaRatio: number) => void;
  setDefaultAsset: (assetId: string, isDefault: boolean) => void;
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
  const [isVisualAssetManagerOpen, setIsVisualAssetManagerOpen] = useState(false);
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
      data: `${activeTab.command}\r`,
    });
  };

  return {
    activateTab,
    activeTabId: state.activeTabId,
    assistantSnapshot,
    closeAssetManager: () => {
      setIsVisualAssetManagerOpen(false);
    },
    closeTab,
    createTab,
    handleLaunchClaude,
    isVisualAssetManagerOpen,
    openAssetManager: () => {
      setIsVisualAssetManagerOpen(true);
    },
    paneSizes: state.paneSizes,
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
    setDefaultAsset: (assetId, isDefault) => {
      void persistVisualAssetCatalog(
        setVisualAssetDefault(visualAssetCatalog, assetId, isDefault),
      );
    },
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
