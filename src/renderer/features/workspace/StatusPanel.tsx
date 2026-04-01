import type { ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';

interface StatusPanelProps {
  activeSessionElapsedLabel: string;
  assistantStatus: AssistantStatusSnapshot;
  runtimeVersion: string;
  taskElapsedLabel: string;
}

const STATE_LABELS: Record<AssistantStatusSnapshot['state'], string> = {
  idle: 'idle',
  thinking: 'thinking',
  working: 'working',
  responding: 'responding',
  waiting: 'waiting',
  surprised: 'surprised',
  sad: 'sad',
  happy: 'happy',
  error: 'error',
};

export function StatusPanel({
  activeSessionElapsedLabel,
  assistantStatus,
  runtimeVersion,
  taskElapsedLabel,
}: StatusPanelProps): ReactElement {
  const stateLabel = STATE_LABELS[assistantStatus.state];

  return (
    <aside className="status-panel" aria-label="Assistant status panel">
      <div
        className={`status-panel__avatar status-panel__avatar--${assistantStatus.state} status-panel__avatar--${assistantStatus.intensity}`}
      >
        <div className="status-panel__avatar-orb" aria-hidden="true" />
        <span className="status-panel__avatar-label">{stateLabel}</span>
      </div>

      <div className="status-panel__content">
        <p className="status-panel__line">{assistantStatus.line}</p>
        <p className="status-panel__meta">
          state: {assistantStatus.state} · task: {assistantStatus.currentTask}
          {' · '}
          task elapsed: {taskElapsedLabel} · session age: {activeSessionElapsedLabel}
          {' · '}
          runtime: Electron {runtimeVersion} · source: {assistantStatus.source}
        </p>
      </div>
    </aside>
  );
}
