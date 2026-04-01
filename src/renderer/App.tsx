import type { ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../shared/assistant-status';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { getActiveTab, getVisibleTabs } from './features/workspace/model';
import { resolveStatusPanelVisual } from './features/workspace/status-panel-visual';
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
  const activeTab = getActiveTab(state);
  const visibleTabs = getVisibleTabs(state);
  const panelId = activeTab !== null ? `panel-${activeTab.id}` : 'panel-stack';
  const fallbackAssistantSnapshot: AssistantStatusSnapshot = {
    state: state.assistantStatus.visualState,
    line: state.assistantStatus.line,
    currentTask: state.assistantStatus.currentTask,
    updatedAtMs: state.assistantStatus.statusSinceMs,
    intensity: 'medium',
    source: 'workspace',
  };
  const assistantSnapshot = useAssistantStatusBridge(fallbackAssistantSnapshot);
  const visualAssetCatalog = useVisualAssetCatalog();
  const statusVisual = resolveStatusPanelVisual(
    assistantSnapshot,
    visualAssetCatalog,
  );

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
          statusVisual={statusVisual}
        />
      </main>
    </div>
  );
}
