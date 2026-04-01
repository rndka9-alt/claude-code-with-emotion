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
    activeTaskElapsedLabel,
    appElapsedLabel,
    activateTab,
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
            <p className="workspace__eyebrow">Terminal Workspace</p>
            <h1 className="workspace__title" id="workspace-heading">
              {activeTabTitle}
            </h1>
            <p className="workspace__copy">
              탭은 세션 포커스를 바꾸고, 본문은 지금 선택한 세션만 보여줘요.
              다른 세션은 탭 뒤에서 살아 잇고, 보이는 건 딱 하나만 남겨둘게요.
            </p>
          </div>

          <PaneStack
            activeTabId={state.activeTabId}
            onActivateTab={activateTab}
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
