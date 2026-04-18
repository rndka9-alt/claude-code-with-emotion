import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ENV_KEYS } from "../../shared/env-keys";

interface HookInvocationResult {
  hookStateFilePath: string;
  eventQueueDir: string;
  traceFilePath: string;
}

interface HookInvocationOptions {
  hookStateFilePath?: string;
  eventQueueDir?: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLatestStatusEvent(
  queueDir: string,
): Record<string, unknown> {
  const files = fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (let i = files.length - 1; i >= 0; i--) {
    const fileName = files[i] as string;
    const event: unknown = JSON.parse(
      fs.readFileSync(path.join(queueDir, fileName), "utf8"),
    );

    if (isObjectRecord(event) && event.type === "status") {
      return event;
    }
  }

  throw new Error("No status event found in queue directory");
}

function readLatestOverlayEvent(
  queueDir: string,
): Record<string, unknown> {
  const files = fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (let i = files.length - 1; i >= 0; i--) {
    const fileName = files[i] as string;
    const event: unknown = JSON.parse(
      fs.readFileSync(path.join(queueDir, fileName), "utf8"),
    );

    if (isObjectRecord(event) && event.type === "overlay") {
      return event;
    }
  }

  throw new Error("No overlay event found in queue directory");
}

function hasOverlayEvent(queueDir: string): boolean {
  try {
    const files = fs
      .readdirSync(queueDir)
      .filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const event: unknown = JSON.parse(
        fs.readFileSync(path.join(queueDir, file), "utf8"),
      );

      if (isObjectRecord(event) && event.type === "overlay") {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function invokeHook(
  eventName: string,
  payload: Record<string, unknown>,
  options?: HookInvocationOptions,
): HookInvocationResult {
  const eventQueueDir =
    options?.eventQueueDir ??
    fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-queue-"));
  const traceFilePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-trace-")),
    "trace.log",
  );
  const hookStateFilePath =
    options?.hookStateFilePath ??
    path.join(eventQueueDir, "hook-state.json");
  const helperBinDir = path.resolve(process.cwd(), "bin");
  const result = spawnSync("node", ["./bin/claude-session-hook", eventName], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
      [ENV_KEYS.TRACE_FILE]: traceFilePath,
      [ENV_KEYS.HELPER_BIN_DIR]: helperBinDir,
      [ENV_KEYS.HOOK_STATE_FILE]: hookStateFilePath,
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
    eventQueueDir,
    traceFilePath,
  };
}

describe("claude-session-hook", () => {
  it("maps PermissionRequest into the permission_wait state", () => {
    const result = invokeHook("PermissionRequest", {
      tool_name: "Bash",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("permission_wait");
    expect(status.line).toBe("권한 확인 기다리는 중이에요...!");
    expect(status.currentTask).toBe("Waiting on permission for Bash");
  });

  it("maps Notification into a waiting+surprised two-axis payload", () => {
    const result = invokeHook("Notification", {
      message: "Build completed successfully",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("waiting");
    expect(status.emotion).toBeUndefined();
    expect(status.line).toBe("새 알림이 와서 확인 중이에요...!");
    expect(status.currentTask).toBe(
      "Notification: Build completed successfully",
    );

    const overlay = readLatestOverlayEvent(result.eventQueueDir);
    expect(overlay.emotion).toBe("surprised");
  });

  it("routes permission_prompt Notification into the permission_wait state", () => {
    const result = invokeHook("Notification", {
      notification_type: "permission_prompt",
      message: "Claude needs your permission to use Bash",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

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
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("working");
    expect(status.line).toBe("새 작업을 하나 시작햇어요...!");
    expect(status.currentTask).toBe("Task: Implement user authentication");
  });

  it("maps PreCompact with matcher into the compacting state and records matcher in task", () => {
    const result = invokeHook("PreCompact", {
      matcher: "manual",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("compacting");
    expect(status.line).toBe("이야기햇던 내용 정리하고 올게요...!");
    expect(status.currentTask).toBe("Compact: manual");
  });

  it("maps PreCompact without matcher into the compacting state with generic task", () => {
    const result = invokeHook("PreCompact", {});
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("compacting");
    expect(status.line).toBe("이야기햇던 내용 정리하고 올게요...!");
    expect(status.currentTask).toBe("Compact");
  });

  it("maps PostCompact into the completed state and records matcher in task", () => {
    const result = invokeHook("PostCompact", {
      matcher: "auto",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("completed");
    expect(status.line).toBe("이야기 정리 끝내고 돌아왓어요...!");
    expect(status.currentTask).toBe("Compact completed: auto");
  });

  it("maps TaskCompleted into a completed+happy two-axis payload", () => {
    const result = invokeHook("TaskCompleted", {
      task_subject: "Finished updating the renderer layout",
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("completed");
    expect(status.emotion).toBeUndefined();
    expect(status.line).toBe("작업 하나를 마무리햇어요...!");
    expect(status.currentTask).toBe(
      "Task: Finished updating the renderer layout",
    );

    const overlay = readLatestOverlayEvent(result.eventQueueDir);
    expect(overlay.emotion).toBe("happy");
  });

  it("maps interrupted stop signals into tool_failed", () => {
    const result = invokeHook("PostToolUseFailure", {
      tool_name: "Bash",
      is_interrupt: true,
    });
    const status = readLatestStatusEvent(result.eventQueueDir);

    expect(status.state).toBe("tool_failed");
    expect(status.line).toBe("유저가 도구 실행을 중간에 멈췃어요...!");
    expect(status.currentTask).toBe("Interrupted during tool use (Bash)");
  });

  it("infers a soft permission cancel when the next event is a new prompt", () => {
    const sharedEventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-hook-shared-queue-"),
    );
    const sharedHookStateFilePath = path.join(
      sharedEventQueueDir,
      "hook-state.json",
    );

    invokeHook(
      "PermissionRequest",
      {
        tool_name: "WebSearch",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        eventQueueDir: sharedEventQueueDir,
      },
    );

    invokeHook(
      "UserPromptSubmit",
      {
        prompt: "흐음.. 다시 정리해줘",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        eventQueueDir: sharedEventQueueDir,
      },
    );
    const status = readLatestStatusEvent(sharedEventQueueDir);

    expect(status.state).toBe("thinking");
    expect(status.line).toBe(
      "권한 승인 없이 넘어와서 새 입력을 읽는 중이에요...!",
    );
    expect(status.currentTask).toBe("Prompt: 흐음.. 다시 정리해줘");
  });

  it("resets the visual overlay emotion and line on SessionStart", () => {
    // /clear 로 Claude CLI 가 재시작댈 때 이전 세션의 한마디·감정 에셋이 남는 버그 방지:
    // SessionStart 훅이 overlay 이벤트에 {"type": "overlay", "emotion": null, "line": null} 을 찍어
    // 스토어의 visualOverlay 를 통째로 비워야 한다.
    const result = invokeHook("SessionStart", {});
    const overlay = readLatestOverlayEvent(result.eventQueueDir);

    expect(overlay.type).toBe("overlay");
    expect(overlay.emotion).toBeNull();
    expect(overlay.line).toBeNull();

    const status = readLatestStatusEvent(result.eventQueueDir);
    expect(status.state).toBe("waiting");
    expect(status.line).toBe("Claude 연결 완료! 다음 입력을 기다리고 잇어요...!");
  });

  it("does not write an overlay event for events without emotion", () => {
    const result = invokeHook("UserPromptSubmit", {
      prompt: "룩앳미",
    });

    // emotion 필드가 읍는 이벤트는 overlay 이벤트를 큐에 넣지 않아야 한다.
    expect(hasOverlayEvent(result.eventQueueDir)).toBe(false);
  });

  it("infers a soft permission cancel when the session closes first", () => {
    const sharedEventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-hook-shared-queue-"),
    );
    const sharedHookStateFilePath = path.join(
      sharedEventQueueDir,
      "hook-state.json",
    );

    invokeHook(
      "PermissionRequest",
      {
        tool_name: "Bash",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        eventQueueDir: sharedEventQueueDir,
      },
    );

    invokeHook(
      "SessionEnd",
      {
        reason: "prompt_input_exit",
      },
      {
        hookStateFilePath: sharedHookStateFilePath,
        eventQueueDir: sharedEventQueueDir,
      },
    );
    const status = readLatestStatusEvent(sharedEventQueueDir);

    expect(status.state).toBe("disconnected");
    expect(status.line).toBe("권한 승인 없이 세션이 닫혓어요...!");
    expect(status.currentTask).toBe(
      "Waiting on permission for Bash (not approved)",
    );
  });
});
