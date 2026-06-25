import { ENV_KEYS } from "../shared/env-keys";
import { runAssistantCliWrapper } from "./lib/assistant-cli-wrapper";
import { createVisualToolUsagePrompt } from "./lib/claude-session-prompts";

function main(): void {
  const hooksSettingsFilePath = process.env[ENV_KEYS.HOOKS_SETTINGS_FILE];
  const visualToolUsagePrompt = createVisualToolUsagePrompt();

  runAssistantCliWrapper({
    binaryName: "claude",
    displayName: "Claude",
    traceLabel: "claude-wrapper",
    createRuntimeArgs: () => {
      const runtimeArgs: string[] = [];

      if (
        typeof hooksSettingsFilePath === "string" &&
        hooksSettingsFilePath.length > 0
      ) {
        runtimeArgs.push("--settings", hooksSettingsFilePath);
      }

      if (visualToolUsagePrompt.trim().length > 0) {
        runtimeArgs.push("--append-system-prompt", visualToolUsagePrompt);
      }

      return runtimeArgs;
    },
    describeRuntime: () => {
      const hooks =
        typeof hooksSettingsFilePath === "string" &&
        hooksSettingsFilePath.length > 0
          ? hooksSettingsFilePath
          : "none";
      const visualPrompt =
        visualToolUsagePrompt.trim().length > 0 ? "present" : "none";

      return `hooks=${hooks} visualMcp=user-scope visualPrompt=${visualPrompt}`;
    },
    status: {
      starting: {
        providerId: "claude",
        state: "working",
        line: "Claude 세션 실행 중이에요...!",
        activity: "Claude 세션 시작하는 중",
        task: "Running Claude in the active terminal",
        intensity: "medium",
      },
      disconnected: {
        providerId: "claude",
        state: "disconnected",
        line: "Claude 세션이 종료돼서 지금은 미연결 상태예요...!",
        activity: "연결 대기 중",
        task: "Waiting for Claude to start",
        intensity: "low",
      },
      error: {
        providerId: "claude",
        state: "error",
        line: "Claude 세션이 에러로 끝낫어요...!",
        activity: "세션 복구가 필요한 상태",
        task: "Claude command exited with an error",
        intensity: "high",
      },
    },
  });
}

main();
