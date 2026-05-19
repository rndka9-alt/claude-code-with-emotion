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
        className="border-border-soft bg-surface-elevated text-text-secondary flex items-start gap-2 border px-3 py-2.5 text-[0.84rem] leading-5"
        role="status"
      >
        <Wrench
          aria-hidden="true"
          className="text-text-accent mt-0.5 h-3.5 w-3.5 shrink-0"
        />
        <p className="m-0">
          Visual MCP 설치는 오른쪽 위 스패너 아이콘 설정에서 할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-text-secondary m-0 text-[0.88rem] leading-5">
        Visual MCP를 쓰려면 Claude user-scope MCP 서버를 한 번 설치해야 합니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="border-border-launch bg-surface-launch text-text-tooltip hover:bg-surface-launch-hover inline-flex h-[26px] items-center justify-center border px-2.5 text-xs font-semibold tracking-[0.01em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isInstalling}
          onClick={onInstall}
          type="button"
        >
          {isInstalling ? "설치중..." : "Visual MCP 설치"}
        </button>
        <button
          className="border-border-soft bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-highlight inline-flex h-[26px] items-center justify-center border px-2.5 text-xs font-medium tracking-[0.01em] transition-colors duration-150"
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
