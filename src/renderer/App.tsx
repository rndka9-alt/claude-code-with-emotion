import { useState, type ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../shared/assistant-status';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { VisualAssetManagerDialog } from './features/workspace/VisualAssetManagerDialog';
import { getActiveTab, getVisibleTabs } from './features/workspace/model';
import { resolveStatusPanelVisual } from './features/workspace/status-panel-visual';
import {
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionMapping,
  setVisualAssetStateMapping,
} from './features/workspace/visual-asset-catalog-edits';
import { useAssistantStatusBridge } from './features/workspace/use-assistant-status-bridge';
import { useVisualAssetCatalog } from './features/workspace/use-visual-asset-catalog';
import { useWorkspaceState } from './features/workspace/use-workspace-state';

export function App(): ReactElement {
  const {
    state,
    activateTab,
    closeTab,
    createTab,
    resizePane,
  } = useWorkspaceState();
  const [isVisualAssetManagerOpen, setIsVisualAssetManagerOpen] = useState(false);
  const activeTab = getActiveTab(state);
  const visibleTabs = getVisibleTabs(state);
  const panelId = activeTab !== null ? `panel-${activeTab.id}` : 'panel-stack';
  const fallbackAssistantSnapshot: AssistantStatusSnapshot = {
    emotion: null,
    state: state.assistantStatus.visualState,
    line: state.assistantStatus.line,
    currentTask: state.assistantStatus.currentTask,
    updatedAtMs: state.assistantStatus.statusSinceMs,
    intensity: 'medium',
    source: 'workspace',
  };
  const assistantSnapshot = useAssistantStatusBridge(fallbackAssistantSnapshot);
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

  const handlePickVisualAssets = async (): Promise<void> => {
    const pickedFiles = await pickVisualAssetFiles();

    if (pickedFiles.length === 0) {
      return;
    }

    await persistVisualAssetCatalog(
      mergePickedVisualAssets(visualAssetCatalog, pickedFiles),
    );
  };

  return (
    <div className="app-shell">
      <TabBar
        activeTabId={state.activeTabId}
        onActivateTab={activateTab}
        onCloseTab={closeTab}
        onCreateTab={createTab}
        tabs={state.tabs}
      />

      <main className="workspace">
        <section
          aria-label="Active terminal workspace"
          className="workspace__terminal-area"
          id={panelId}
          role="tabpanel"
        >
          <PaneStack
            onResizePane={resizePane}
            paneSizes={state.paneSizes}
            tabs={visibleTabs}
          />
        </section>

        <StatusPanel
          assistantStatus={assistantSnapshot}
          onOpenAssetManager={() => {
            setIsVisualAssetManagerOpen(true);
          }}
          statusVisual={statusVisual}
        />
      </main>

      {isVisualAssetManagerOpen ? (
        <VisualAssetManagerDialog
          catalog={visualAssetCatalog}
          onClose={() => {
            setIsVisualAssetManagerOpen(false);
          }}
          onPickFiles={() => {
            void handlePickVisualAssets();
          }}
          onRemoveAsset={(assetId) => {
            void persistVisualAssetCatalog(
              removeVisualAsset(visualAssetCatalog, assetId),
            );
          }}
          onSetDefaultAsset={(assetId, isDefault) => {
            void persistVisualAssetCatalog(
              setVisualAssetDefault(visualAssetCatalog, assetId, isDefault),
            );
          }}
          onToggleEmotion={(assetId, emotion, isEnabled) => {
            void persistVisualAssetCatalog(
              setVisualAssetEmotionMapping(
                visualAssetCatalog,
                assetId,
                emotion,
                isEnabled,
              ),
            );
          }}
          onToggleState={(assetId, statePreset, isEnabled) => {
            void persistVisualAssetCatalog(
              setVisualAssetStateMapping(
                visualAssetCatalog,
                assetId,
                statePreset,
                isEnabled,
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}
