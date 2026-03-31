import type { ReactElement } from 'react';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { getActiveTab } from './features/workspace/model';
import { useWorkspaceState } from './features/workspace/use-workspace-state';

export function App(): ReactElement {
  const {
    state,
    activeTabTitle,
    activeTaskElapsedLabel,
    appElapsedLabel,
    activateTab,
    createTab,
  } = useWorkspaceState();
  const appVersion = window.claudeApp?.appVersion ?? 'unknown';
  const activeTab = getActiveTab(state);
  const lifecycle = activeTab !== null ? activeTab.lifecycle : 'bootstrapping';
  const sessionCommand = activeTab !== null ? activeTab.command : 'claude';
  const sessionCwd = activeTab !== null ? activeTab.cwd : '.';
  const panelId = activeTab !== null ? `panel-${activeTab.id}` : 'panel-empty';

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
          <div className="workspace__hero">
            <p className="workspace__eyebrow">Session Workspace</p>
            <h1 className="workspace__title" id="workspace-heading">
              {activeTabTitle}
            </h1>
            <p className="workspace__copy">
              탭 제목은 앱 상태가 들고 있고, 앞으로 들어올 terminal title
              change나 <code>/rename</code> 신호는 보조 힌트로만 취급할 거예요.
            </p>
          </div>

          <div className="workspace__details">
            <article className="workspace-card">
              <p className="workspace-card__label">Command</p>
              <p className="workspace-card__value">{sessionCommand}</p>
            </article>
            <article className="workspace-card">
              <p className="workspace-card__label">Lifecycle</p>
              <p className="workspace-card__value">{lifecycle}</p>
            </article>
            <article className="workspace-card workspace-card--wide">
              <p className="workspace-card__label">Workspace</p>
              <p className="workspace-card__value workspace-card__value--path">
                {sessionCwd}
              </p>
            </article>
            <article className="workspace-card workspace-card--wide">
              <p className="workspace-card__label">Next Up</p>
              <ul className="workspace-card__list">
                <li>Vertically stacked terminal panes with drag handles</li>
                <li>xterm.js surface and typed preload bridge</li>
                <li>node-pty sessions that can launch Claude Code</li>
              </ul>
            </article>
          </div>
        </section>

        <StatusPanel
          activeSessionElapsedLabel={appElapsedLabel}
          assistantStatus={state.assistantStatus}
          runtimeVersion={appVersion}
          taskElapsedLabel={activeTaskElapsedLabel}
        />
      </main>
    </div>
  );
}
