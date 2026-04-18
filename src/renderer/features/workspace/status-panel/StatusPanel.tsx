import type { CSSProperties, ReactElement } from "react";
import { Play, Wrench } from "lucide-react";
import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { McpSetupPrompt } from "./_components";
import type { StatusPanelVisual } from "./status-panel-visual";

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
  AssistantStatusSnapshot["state"],
  string
> = {
  disconnected: "--color-avatar-idle",
  thinking: "--color-avatar-thinking",
  working: "--color-avatar-working",
  waiting: "--color-avatar-idle",
  permission_wait: "--color-avatar-idle",
  tool_failed: "--color-avatar-error",
  // compacting 은 working 과 비슷한 "손 움직이는 중" 느낌이라 working 색상을 빌려 쓴다.
  compacting: "--color-avatar-working",
  // completed 는 기분 좋은 마무리라 happy 의 업비트 색과 동일 톤을 재사용.
  completed: "--color-avatar-happy",
  error: "--color-avatar-error",
};

const orbClassNameByIntensity: Record<
  AssistantStatusSnapshot["intensity"],
  string
> = {
  low: "opacity-75",
  medium: "opacity-90",
  high: "scale-[1.06] shadow-avatar-orb-strong",
};

type AvatarStyle = CSSProperties & {
  "--avatar-surface": string;
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
  const isDisconnected = assistantStatus.state === "disconnected";
  const avatarStyle: AvatarStyle = {
    "--avatar-surface":
      statusVisual === null
        ? `var(${avatarBackgroundVariableByState[assistantStatus.state]})`
        : "var(--color-avatar-image)",
  };
  const visibleLine = statusLine.length > 0 ? statusLine : assistantStatus.line;

  // MCP 한마디(overlayLine)가 활성화된 경우 활동 라벨을 별도 span으로 분리해 투명도 적용
  const overlayMainText =
    typeof assistantStatus.overlayLine === "string"
      ? assistantStatus.overlayLine.trim()
      : null;
  const hasOverlayLine =
    overlayMainText !== null && overlayMainText.length > 0;
  const overlayActivitySuffix =
    hasOverlayLine &&
    typeof assistantStatus.activityLabel === "string" &&
    assistantStatus.activityLabel.trim().length > 0
      ? assistantStatus.activityLabel.trim()
      : null;

  return (
    <aside
      aria-label="Assistant status panel"
      className="relative flex flex-none items-center border border-border-panel bg-surface-panel max-[900px]:min-h-28"
    >
      <button
        aria-label="Open settings"
        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center border border-border-overlay bg-surface-frost text-text-overlay transition-[background-color,color,border-color] duration-150 hover:border-border-strong hover:bg-surface-frost-strong hover:text-text-inverse"
        onClick={onOpenSettings}
        title="Open settings"
        type="button"
      >
        <Wrench aria-hidden="true" className="h-[14px] w-[14px]" />
      </button>

      <div
        className="group relative flex aspect-square w-32 shrink-0 flex-col items-center justify-center gap-2.5 overflow-hidden bg-[var(--avatar-surface)]"
        style={avatarStyle}
      >
        {statusVisual === null ? (
          <div
            aria-hidden="true"
            className={`status-panel__avatar-orb h-20 w-20 bg-avatar-orb shadow-avatar-orb transition-[transform,opacity,box-shadow] duration-150 ${orbClassNameByIntensity[assistantStatus.intensity]}`}
          />
        ) : (
          <img
            alt={statusVisual.resolution.asset.label}
            className="block h-full w-full object-cover"
            src={statusVisual.assetUrl}
          />
        )}

        {isDisconnected && (
          <button
            aria-label="실행하기"
            className="absolute inset-0 cursor-pointer transition-[background-color,transform] duration-150 hover:bg-surface-launch-hover/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
            onClick={onLaunchClaude}
            title="실행하기"
            type="button"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 left-1/2 top-0 inline-flex h-[26px] w-[26px] -translate-x-1/2 items-center justify-center border border-border-launch bg-surface-launch text-text-tooltip transition-colors duration-150 group-hover:bg-surface-launch"
            >
              <Play
                aria-hidden="true"
                className="h-3.5 w-3.5 translate-x-[0.5px]"
                fill="currentColor"
              />
            </span>
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 px-5 py-4">
        <p className="m-0 whitespace-pre-line text-[1.08rem] text-text-highlight">
          {overlayMainText !== null ? (
            <>
              {overlayMainText}
              {overlayActivitySuffix !== null && (
                <>
                  <br />
                  <span className="opacity-40">({overlayActivitySuffix})</span>
                </>
              )}
            </>
          ) : (
            visibleLine
          )}
        </p>
        {!mcpSetupInstalled ? (
          <McpSetupPrompt
            isDismissed={isMcpSetupPromptDismissed}
            isInstalling={isInstallingVisualMcp}
            onDismiss={onDismissMcpSetupPrompt}
            onInstall={onInstallVisualMcp}
            setupError={mcpSetupError}
          />
        ) : null}
      </div>
    </aside>
  );
}
