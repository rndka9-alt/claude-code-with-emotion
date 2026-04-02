import type { CSSProperties, ReactElement } from 'react';
import { Images } from 'lucide-react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import {
  isAppThemeId,
  type AppThemeId,
  type AppThemeOption,
} from '../../../shared/theme';
import type { StatusPanelVisual } from './status-panel-visual';

interface StatusPanelProps {
  assistantStatus: AssistantStatusSnapshot;
  availableThemes: AppThemeOption[];
  currentThemeId: AppThemeId;
  onOpenAssetManager: () => void;
  onLaunchClaude: () => void;
  onSelectTheme: (themeId: AppThemeId) => void;
  statusLine: string;
  statusVisual: StatusPanelVisual | null;
}

const avatarBackgroundVariableByState: Record<
  AssistantStatusSnapshot['state'],
  string
> = {
  disconnected: '--color-avatar-idle',
  idle: '--color-avatar-idle',
  thinking: '--color-avatar-thinking',
  working: '--color-avatar-working',
  responding: '--color-avatar-responding',
  waiting: '--color-avatar-idle',
  surprised: '--color-avatar-surprised',
  sad: '--color-avatar-sad',
  happy: '--color-avatar-happy',
  error: '--color-avatar-error',
};

const orbClassNameByIntensity: Record<AssistantStatusSnapshot['intensity'], string> = {
  low: 'opacity-75',
  medium: 'opacity-90',
  high: 'scale-[1.06] shadow-[var(--shadow-avatar-orb-strong)]',
};

type AvatarStyle = CSSProperties & {
  '--avatar-surface': string;
};

export function StatusPanel({
  assistantStatus,
  availableThemes,
  currentThemeId,
  onOpenAssetManager,
  onLaunchClaude,
  onSelectTheme,
  statusLine,
  statusVisual,
}: StatusPanelProps): ReactElement {
  const avatarStyle: AvatarStyle = {
    '--avatar-surface':
      statusVisual === null
        ? `var(${avatarBackgroundVariableByState[assistantStatus.state]})`
        : 'var(--color-avatar-image)',
  };
  const orbClassName = [
    'status-panel__avatar-orb h-16 w-16 bg-[var(--color-avatar-orb)] shadow-[var(--shadow-avatar-orb)] transition-[transform,opacity,box-shadow] duration-150 max-[900px]:h-[52px] max-[900px]:w-[52px]',
    orbClassNameByIntensity[assistantStatus.intensity],
  ].join(' ');

  return (
    <aside
      className="grid min-h-32 max-h-32 flex-none grid-cols-[112px_minmax(0,1fr)] items-center gap-[18px] border border-[var(--color-border-panel)] bg-[var(--color-surface-panel)] px-5 py-4 max-[900px]:min-h-28 max-[900px]:max-h-28 max-[900px]:grid-cols-[88px_minmax(0,1fr)]"
      aria-label="Assistant status panel"
    >
      <div
        className="group relative flex aspect-square w-28 flex-col items-center justify-center gap-2.5 overflow-hidden bg-[var(--avatar-surface)] max-[900px]:w-[88px]"
        style={avatarStyle}
      >
        <button
          aria-label="Open visual asset manager"
          className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center border border-[var(--color-border-overlay)] bg-[var(--color-surface-frost)] text-[var(--color-text-overlay)] opacity-0 transition-[opacity,background-color,color] duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--color-surface-frost-strong)] hover:text-[var(--color-text-inverse)]"
          onClick={onOpenAssetManager}
          title="Customize status visuals"
          type="button"
        >
          <Images aria-hidden="true" className="h-[13px] w-[13px]" />
        </button>

        {statusVisual === null ? (
          <div className={orbClassName} aria-hidden="true" />
        ) : (
          <img
            alt={statusVisual.resolution.asset.label}
            className="block h-full w-full object-cover"
            src={statusVisual.assetUrl}
          />
        )}

        {assistantStatus.state === 'disconnected' ? (
          <button
            className="absolute bottom-2 left-1/2 h-[26px] -translate-x-1/2 border border-[var(--color-border-launch)] bg-[var(--color-surface-launch)] px-2.5 text-xs font-semibold tracking-[0.01em] text-[var(--color-text-tooltip)] transition-colors duration-150 hover:bg-[var(--color-surface-launch-hover)]"
            onClick={onLaunchClaude}
            type="button"
          >
            실행하기
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-3">
        <p className="m-0 text-[1.08rem] text-[var(--color-text-highlight)]">
          {statusLine}
        </p>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)]">
          <span className="shrink-0 uppercase tracking-[0.08em]">Theme</span>
          <select
            aria-label="App theme"
            className="min-w-0 flex-1 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors duration-150 focus:border-[var(--color-border-strong)]"
            onChange={(event) => {
              const nextThemeId = event.currentTarget.value;

              if (isAppThemeId(nextThemeId)) {
                onSelectTheme(nextThemeId);
              }
            }}
            value={currentThemeId}
          >
            {availableThemes.map((themeOption) => {
              return (
                <option key={themeOption.id} value={themeOption.id}>
                  {themeOption.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>
    </aside>
  );
}
