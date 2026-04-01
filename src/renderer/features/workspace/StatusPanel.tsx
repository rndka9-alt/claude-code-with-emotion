import type { ReactElement } from 'react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';

interface StatusPanelProps {
  assistantStatus: AssistantStatusSnapshot;
}

export function StatusPanel({
  assistantStatus,
}: StatusPanelProps): ReactElement {
  return (
    <aside className="status-panel" aria-label="Assistant status panel">
      <div
        className={`status-panel__avatar status-panel__avatar--${assistantStatus.state} status-panel__avatar--${assistantStatus.intensity}`}
      >
        <div className="status-panel__avatar-orb" aria-hidden="true" />
      </div>

      <div className="status-panel__content">
        <p className="status-panel__line">{assistantStatus.line}</p>
      </div>
    </aside>
  );
}
