import type { ReactElement } from 'react';

const INITIAL_TABS = [
  {
    id: 'session-1',
    title: 'Claude Code Session',
    activity: 'Scaffold baseline app shell',
  },
];

export function App(): ReactElement {
  const activeTab = INITIAL_TABS[0];
  const appVersion = window.claudeApp?.appVersion ?? 'unknown';
  const activeTitle = activeTab?.title ?? 'No session';
  const activeActivity = activeTab?.activity ?? 'Waiting for session';

  return (
    <div className="app-shell">
      <header className="tab-bar" aria-label="Terminal sessions">
        <div className="tab-strip">
          {INITIAL_TABS.map((tab) => {
            return (
              <button
                key={tab.id}
                className="tab-button tab-button--active"
                type="button"
              >
                <span className="tab-button__label">{tab.title}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="workspace">
        <section className="workspace__terminal-area" aria-label="Terminal workspace">
          <div className="terminal-placeholder">
            <p className="terminal-placeholder__eyebrow">Bootstrap milestone</p>
            <h1 className="terminal-placeholder__title">{activeTitle}</h1>
            <p className="terminal-placeholder__copy">
              Electron, React, TypeScript, and preload wiring are in place.
              Terminal sessions, PTY integration, and semantic status updates come next.
            </p>
            <p className="terminal-placeholder__meta">
              Electron runtime: {appVersion}
            </p>
          </div>
        </section>

        <aside className="status-panel" aria-label="Assistant status panel">
          <div className="status-panel__avatar" aria-hidden="true">
            <div className="status-panel__avatar-orb" />
          </div>

          <div className="status-panel__content">
            <p className="status-panel__line">
              일단 뼈대는 세웟어요. 이제 진짜 공사 들어가요...!
            </p>
            <p className="status-panel__meta">
              state: working · task: {activeActivity} · phase: bootstrap
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
