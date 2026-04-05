import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface HookInvocationResult {
  hookStateFilePath: string;
  statusFilePath: string;
  traceFilePath: string;
  overlayFilePath: string;
}

interface HookInvocationOptions {
  hookStateFilePath?: string;
  statusFilePath?: string;
  overlayFilePath?: string;
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
  const overlayFilePath =
    options?.overlayFilePath ??
    path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-overlay-")),
      "overlay.json",
    );
  const helperBinDir = path.resolve(process.cwd(), "bin");
  const result = spawnSync("node", ["./bin/claude-session-hook", eventName], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_WITH_EMOTION_STATUS_FILE: statusFilePath,
      CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
      CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
      CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: hookStateFilePath,
      CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
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
    overlayFilePath,
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
  it("maps PermissionRequest into the permission_wait state", () => {
    const result = invokeHook("PermissionRequest", {
      tool_name: "Bash",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("permission_wait");
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

  it("routes permission_prompt Notification into the permission_wait state", () => {
    const result = invokeHook("Notification", {
      notification_type: "permission_prompt",
      message: "Claude needs your permission to use Bash",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("permission_wait");
    expect(status.line).toBe("권한 팝업 확인 중이에요...!");
    expect(status.currentTask).toBe(
      "Permission: Claude needs your permission to use Bash",
    );
  });

  it("maps TaskCreated into a working state", () => {
    const result = invokeHook("TaskCreated", {
      task_subject: "Implement user authentication",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("working");
    expect(status.line).toBe("새 작업을 하나 시작햇어요...!");
    expect(status.currentTask).toBe("Task: Implement user authentication");
  });

  it("maps PreCompact with matcher into the compacting state and records matcher in task", () => {
    const result = invokeHook("PreCompact", {
      matcher: "manual",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("compacting");
    expect(status.line).toBe("이야기햇던 내용 정리하고 올게요...!");
    expect(status.currentTask).toBe("Compact: manual");
  });

  it("maps PreCompact without matcher into the compacting state with generic task", () => {
    const result = invokeHook("PreCompact", {});
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("compacting");
    expect(status.line).toBe("이야기햇던 내용 정리하고 올게요...!");
    expect(status.currentTask).toBe("Compact");
  });

  it("maps PostCompact into the completed state and records matcher in task", () => {
    const result = invokeHook("PostCompact", {
      matcher: "auto",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("completed");
    expect(status.line).toBe("이야기 정리 끝내고 돌아왓어요...!");
    expect(status.currentTask).toBe("Compact completed: auto");
  });

  it("maps TaskCompleted into a happy transient state", () => {
    const result = invokeHook("TaskCompleted", {
      task_subject: "Finished updating the renderer layout",
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("happy");
    expect(status.line).toBe("작업 하나를 마무리햇어요...!");
    expect(status.currentTask).toBe(
      "Task: Finished updating the renderer layout",
    );
  });

  it("maps interrupted stop signals into the interrupted state", () => {
    const result = invokeHook("PostToolUseFailure", {
      tool_name: "Bash",
      is_interrupt: true,
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe("interrupted");
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

  it("resets the visual overlay emotion and line on SessionStart", () => {
    // /clear 로 Claude CLI 가 재시작댈 때 이전 세션의 한마디·감정 에셋이 남는 버그 방지:
    // SessionStart 훅이 overlay 파일에 {"emotion": null, "line": null} 을 찍어
    // 스토어의 visualOverlay 를 통째로 비워야 한다.
    const result = invokeHook("SessionStart", {});
    const overlayPayload: unknown = JSON.parse(
      fs.readFileSync(result.overlayFilePath, "utf8"),
    );

    expect(overlayPayload).toEqual({ emotion: null, line: null });

    const status = readStatusFile(result.statusFilePath);
    expect(status.state).toBe("waiting");
    expect(status.line).toBe("Claude 연결 완료! 다음 입력을 기다리고 잇어요...!");
  });

  it("does not touch the overlay file for non-SessionStart events", () => {
    const result = invokeHook("UserPromptSubmit", {
      prompt: "룩앳미",
    });

    // claude-visual-state 가 호출댄 적이 읍스니 overlay 파일은 생성되지 않아야 한다.
    expect(fs.existsSync(result.overlayFilePath)).toBe(false);
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
