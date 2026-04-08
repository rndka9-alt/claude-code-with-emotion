import type { ReactElement } from "react";
import { Wrench } from "lucide-react";

interface McpSetupPromptProps {
  isDismissed: boolean;
  isInstalling: boolean;
  setupError: string | null;
  onDismiss: () => void;
  onInstall: () => void;
}

export function McpSetupPrompt({
  isDismissed,
  isInstalling,
  setupError,
  onDismiss,
  onInstall,
}: McpSetupPromptProps): ReactElement {
  if (isDismissed) {
    return (
      <div
        className="flex items-start gap-2 border border-border-soft bg-surface-elevated px-3 py-2.5 text-[0.84rem] leading-5 text-text-secondary"
        role="status"
      >
        <Wrench
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-accent"
        />
        <p className="m-0">
          Visual MCP 설치는 오른쪽 위 스패너 아이콘 설정에서 할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="m-0 text-[0.88rem] leading-5 text-text-secondary">
        Visual MCP를 쓰려면 Claude user-scope MCP 서버를 한 번 설치해야 합니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-[26px] items-center justify-center border border-border-launch bg-surface-launch px-2.5 text-xs font-semibold tracking-[0.01em] text-text-tooltip transition-colors duration-150 hover:bg-surface-launch-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isInstalling}
          onClick={onInstall}
          type="button"
        >
          {isInstalling ? "설치중..." : "Visual MCP 설치"}
        </button>
        <button
          className="inline-flex h-[26px] items-center justify-center border border-border-soft bg-surface-elevated px-2.5 text-xs font-medium tracking-[0.01em] text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight"
          onClick={onDismiss}
          type="button"
        >
          다시 묻지 않기
        </button>
      </div>
      {setupError !== null ? (
        <p className="m-0 text-[0.82rem] leading-5 text-[#ffb4b4]">
          {setupError}
        </p>
      ) : null}
    </div>
  );
}
