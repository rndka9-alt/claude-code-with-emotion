import type { ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../shared/assistant-status';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import {
  formatElapsedLabel,
  getActiveTab,
  getVisibleTabs,
} from './features/workspace/model';
import { useAssistantStatusBridge } from './features/workspace/use-assistant-status-bridge';
import { useWorkspaceState } from './features/workspace/use-workspace-state';

export function App(): ReactElement {
  const {
    state,
    activeTabTitle,
    activateTab,
    appElapsedLabel,
    createTab,
    resizePane,
  } = useWorkspaceState();
  const appVersion = window.claudeApp?.appVersion ?? 'unknown';
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
  const taskElapsedLabel = formatElapsedLabel(
    Date.now() - assistantSnapshot.updatedAtMs,
  );

  return (
    <div className="app-shell">
      <TabBar
        activeTabId={state.activeTabId}
        onActivateTab={activateTab}
        onCreateTab={createTab}
        tabs={state.tabs}
      />

      <main className="workspace">
        <section
          aria-labelledby="workspace-heading"
          className="workspace__terminal-area"
          id={panelId}
          role="tabpanel"
        >
          <div className="workspace__header">
            <h1 className="workspace__title" id="workspace-heading">
              {activeTabTitle}
            </h1>
          </div>

          <PaneStack
            onResizePane={resizePane}
            paneSizes={state.paneSizes}
            tabs={visibleTabs}
          />
        </section>

        <StatusPanel
          activeSessionElapsedLabel={appElapsedLabel}
          assistantStatus={assistantSnapshot}
          runtimeVersion={appVersion}
          taskElapsedLabel={taskElapsedLabel}
        />
      </main>
    </div>
  );
}
