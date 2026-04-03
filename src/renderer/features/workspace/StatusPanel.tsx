import type { CSSProperties, ReactElement } from 'react';
import { Wrench } from 'lucide-react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import type { StatusPanelVisual } from './status-panel-visual';

interface StatusPanelProps {
  assistantStatus: AssistantStatusSnapshot;
  isInstallingVisualMcp: boolean;
  isMcpSetupPromptDismissed: boolean;
  mcpSetupError: string | null;
  mcpSetupInstalled: boolean;
  onDismissMcpSetupPrompt: () => void;
  onInstallVisualMcp: () => void;
  onLaunchClaude: () => void;
  onOpenSettings: () => void;
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

const orbClassNameByIntensity: Record<
  AssistantStatusSnapshot['intensity'],
  string
> = {
  low: 'opacity-75',
  medium: 'opacity-90',
  high: 'scale-[1.06] shadow-[var(--shadow-avatar-orb-strong)]',
};

type AvatarStyle = CSSProperties & {
  '--avatar-surface': string;
};

export function StatusPanel({
  assistantStatus,
  isInstallingVisualMcp,
  isMcpSetupPromptDismissed,
  mcpSetupError,
  mcpSetupInstalled,
  onDismissMcpSetupPrompt,
  onInstallVisualMcp,
  onLaunchClaude,
  onOpenSettings,
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
  const visibleLine = statusLine.length > 0 ? statusLine : assistantStatus.line;

  return (
    <aside
      aria-label="Assistant status panel"
      className="relative grid min-h-32 max-h-32 flex-none grid-cols-[112px_minmax(0,1fr)] items-center gap-[18px] border border-[var(--color-border-panel)] bg-[var(--color-surface-panel)] px-5 py-4 max-[900px]:min-h-28 max-[900px]:max-h-28 max-[900px]:grid-cols-[88px_minmax(0,1fr)]"
    >
      <button
        aria-label="Open settings"
        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center border border-[var(--color-border-overlay)] bg-[var(--color-surface-frost)] text-[var(--color-text-overlay)] transition-[background-color,color,border-color] duration-150 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-frost-strong)] hover:text-[var(--color-text-inverse)]"
        onClick={onOpenSettings}
        title="Open settings"
        type="button"
      >
        <Wrench aria-hidden="true" className="h-[14px] w-[14px]" />
      </button>

      <div
        className="group relative flex aspect-square w-28 flex-col items-center justify-center gap-2.5 overflow-hidden bg-[var(--avatar-surface)] max-[900px]:w-[88px]"
        style={avatarStyle}
      >
        {statusVisual === null ? (
          <div aria-hidden="true" className={orbClassName} />
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
          {visibleLine}
        </p>
        {!mcpSetupInstalled ? (
          isMcpSetupPromptDismissed ? (
            <div
              className="flex items-start gap-2 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-[0.84rem] leading-5 text-[var(--color-text-secondary)]"
              role="status"
            >
              <Wrench
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-accent)]"
              />
              <p className="m-0">
                Visual MCP 설치는 오른쪽 위 스패너 아이콘 설정에서 할 수 있어요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-[0.88rem] leading-5 text-[var(--color-text-secondary)]">
                Visual MCP를 쓰려면 Claude user-scope MCP 서버를 한 번 설치해야
                합니다.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-[26px] items-center justify-center border border-[var(--color-border-launch)] bg-[var(--color-surface-launch)] px-2.5 text-xs font-semibold tracking-[0.01em] text-[var(--color-text-tooltip)] transition-colors duration-150 hover:bg-[var(--color-surface-launch-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isInstallingVisualMcp}
                  onClick={onInstallVisualMcp}
                  type="button"
                >
                  {isInstallingVisualMcp ? '설치중...' : 'Visual MCP 설치'}
                </button>
                <button
                  className="inline-flex h-[26px] items-center justify-center border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-2.5 text-xs font-medium tracking-[0.01em] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-highlight)]"
                  onClick={onDismissMcpSetupPrompt}
                  type="button"
                >
                  다시 묻지 않기
                </button>
              </div>
              {mcpSetupError !== null ? (
                <p className="m-0 text-[0.82rem] leading-5 text-[#ffb4b4]">
                  {mcpSetupError}
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </aside>
  );
}
