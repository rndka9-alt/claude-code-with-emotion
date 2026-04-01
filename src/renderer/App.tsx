import type { ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../shared/assistant-status';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { formatElapsedLabel, getActiveTab } from './features/workspace/model';
import { useAssistantStatusBridge } from './features/workspace/use-assistant-status-bridge';
import { useWorkspaceState } from './features/workspace/use-workspace-state';

export function App(): ReactElement {
  const {
    state,
    activeTabTitle,
    activeTaskElapsedLabel,
    appElapsedLabel,
    activateTab,
    createTab,
    resizePane,
  } = useWorkspaceState();
  const appVersion = window.claudeApp?.appVersion ?? 'unknown';
  const activeTab = getActiveTab(state);
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
            <p className="workspace__eyebrow">Terminal Workspace</p>
            <h1 className="workspace__title" id="workspace-heading">
              {activeTabTitle}
            </h1>
            <p className="workspace__copy">
              탭은 세션 포커스를 바꾸고, 아래 pane stack은 각 세션을 세로로
              쌓아 보여줘요. 높이 조절은 drag handle로 바로 만질 수 잇어요.
            </p>
          </div>

          <PaneStack
            activeTabId={state.activeTabId}
            onActivateTab={activateTab}
            onResizePane={resizePane}
            paneSizes={state.paneSizes}
            tabs={state.tabs}
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
