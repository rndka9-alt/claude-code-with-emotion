import type { ReactElement } from 'react';
import { Images } from 'lucide-react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import type { StatusPanelVisual } from './status-panel-visual';
import { formatStatusPanelLine } from './status-panel-line';

interface StatusPanelProps {
  assistantStatus: AssistantStatusSnapshot;
  onOpenAssetManager: () => void;
  onLaunchClaude: () => void;
  statusVisual: StatusPanelVisual | null;
}

export function StatusPanel({
  assistantStatus,
  onOpenAssetManager,
  onLaunchClaude,
  statusVisual,
}: StatusPanelProps): ReactElement {
  const visibleLine = formatStatusPanelLine(assistantStatus);
  const avatarClassName = [
    'status-panel__avatar',
    `status-panel__avatar--${assistantStatus.state}`,
    `status-panel__avatar--${assistantStatus.intensity}`,
    statusVisual !== null ? 'status-panel__avatar--image' : '',
  ]
    .filter((className) => className.length > 0)
    .join(' ');

  return (
    <aside className="status-panel" aria-label="Assistant status panel">
      <div className={avatarClassName}>
        <button
          aria-label="Open visual asset manager"
          className="status-panel__avatar-button"
          onClick={onOpenAssetManager}
          title="Customize status visuals"
          type="button"
        >
          <Images aria-hidden="true" className="status-panel__avatar-button-icon" />
        </button>

        {statusVisual === null ? (
          <div className="status-panel__avatar-orb" aria-hidden="true" />
        ) : (
          <img
            alt={statusVisual.resolution.asset.label}
            className="status-panel__avatar-image"
            src={statusVisual.assetUrl}
          />
        )}

        {assistantStatus.state === 'disconnected' ? (
          <button
            className="status-panel__launch-button"
            onClick={onLaunchClaude}
            type="button"
          >
            실행하기
          </button>
        ) : null}
      </div>

      <div className="status-panel__content">
        <p className="status-panel__line">{visibleLine}</p>
      </div>
    </aside>
  );
}
