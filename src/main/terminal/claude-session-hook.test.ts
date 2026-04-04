import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface HookInvocationResult {
  hookStateFilePath: string;
  statusFilePath: string;
  traceFilePath: string;
}

interface HookInvocationOptions {
  hookStateFilePath?: string;
  statusFilePath?: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invokeHook(
  eventName: string,
  payload: Record<string, unknown>,
  options?: HookInvocationOptions,
): HookInvocationResult {
  const statusFilePath =
    options?.statusFilePath ??
    path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-status-")),
      "status.json",
    );
  const traceFilePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-trace-")),
    "trace.log",
  );
  const hookStateFilePath =
    options?.hookStateFilePath ?? `${statusFilePath}.hook-state.json`;
  const helperBinDir = path.resolve(process.cwd(), "bin");
  const result = spawnSync("node", ["./bin/claude-session-hook", eventName], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_WITH_EMOTION_STATUS_FILE: statusFilePath,
      CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
      CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
      CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: hookStateFilePath,
    },
    input: JSON.stringify(payload),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Hook invocation failed for ${eventName}: ${result.stderr || result.stdout}`,
    );
  }

  return {
    hookStateFilePath,
    statusFilePath,
    traceFilePath,
  };
}

function readStatusFile(statusFilePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(fs.readFileSync(statusFilePath, "utf8"));

  if (!isObjectRecord(parsed)) {
    throw new Error("Expected hook status file to contain an object payload");
  }

  return parsed;
}

describe("claude-session-hook", () => {
  it("maps PermissionRequest into a waiting state", () => {
    const result = invokeHook("PermissionRequest", {
      tool_name: "Bash",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("waiting");
    expect(status.line).toBe("권한 확인 기다리는 중이에요...!");
    expect(status.currentTask).toBe("Waiting on permission for Bash");
  });

  it("maps Notification into a surprised transient state", () => {
    const result = invokeHook("Notification", {
      message: "Build completed successfully",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("surprised");
    expect(status.line).toBe("새 알림이 와서 확인 중이에요...!");
    expect(status.currentTask).toBe(
      "Notification: Build completed successfully",
    );
  });

  it("maps TaskCompleted into a happy transient state", () => {
    const result = invokeHook("TaskCompleted", {
      description: "Finished updating the renderer layout",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("happy");
    expect(status.line).toBe("작업 하나를 마무리햇어요...!");
    expect(status.currentTask).toBe(
      "Task: Finished updating the renderer layout",
    );
  });

  it("maps interrupted stop signals into a waiting interruption message", () => {
    const result = invokeHook("PostToolUseFailure", {
      tool_name: "Bash",
      is_interrupt: true,
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("waiting");
    expect(status.line).toBe("유저가 도구 실행을 중간에 멈췃어요...!");
    expect(status.currentTask).toBe("Interrupted during tool use (Bash)");
  });

  it("infers a soft permission cancel when the next event is a new prompt", () => {
    const sharedStatusFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-shared-status-")),
      "status.json",
    );
    const sharedHookStateFilePath = `${sharedStatusFilePath}.hook-state.json`;

    invokeHook(
      "PermissionRequest",
      {
        tool_name: "WebSearch",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        statusFilePath: sharedStatusFilePath,
      },
    );

    const result = invokeHook(
      "UserPromptSubmit",
      {
        prompt: "흐음.. 다시 정리해줘",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        statusFilePath: sharedStatusFilePath,
      },
    );
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("thinking");
    expect(status.line).toBe(
      "권한 승인 없이 넘어와서 새 입력을 읽는 중이에요...!",
    );
    expect(status.currentTask).toBe("Prompt: 흐음.. 다시 정리해줘");
  });

  it("infers a soft permission cancel when the session closes first", () => {
    const sharedStatusFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-shared-status-")),
      "status.json",
    );
    const sharedHookStateFilePath = `${sharedStatusFilePath}.hook-state.json`;

    invokeHook(
      "PermissionRequest",
      {
        tool_name: "Bash",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        statusFilePath: sharedStatusFilePath,
      },
    );

    const result = invokeHook(
      "SessionEnd",
      {
        reason: "prompt_input_exit",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        statusFilePath: sharedStatusFilePath,
      },
    );
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("disconnected");
    expect(status.line).toBe("권한 승인 없이 세션이 닫혓어요...!");
    expect(status.currentTask).toBe(
      "Waiting on permission for Bash (not approved)",
    );
  });
});
