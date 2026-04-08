import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildClaudeHookCommand,
  createClaudeHooksSettings,
  ensureClaudeHooksSettingsFile,
} from "./settings";

describe("claude hooks settings", () => {
  it("builds absolute hook commands for Claude event hooks", () => {
    const command = buildClaudeHookCommand(
      "/tmp/helper-bin",
      "UserPromptSubmit",
    );

    expect(command).toBe(
      "'/tmp/helper-bin/claude-session-hook' 'UserPromptSubmit'",
    );
  });

  it("creates event hook settings for the Claude session lifecycle", () => {
    const settings = createClaudeHooksSettings("/tmp/helper-bin");

    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toContain(
      "SessionStart",
    );
    expect(settings.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toContain(
      "UserPromptSubmit",
    );
    expect(settings.hooks.PermissionRequest[0]?.hooks[0]?.command).toContain(
      "PermissionRequest",
    );
    expect(settings.hooks.PermissionDenied[0]?.hooks[0]?.command).toContain(
      "PermissionDenied",
    );
    expect(settings.hooks.PreToolUse[0]?.hooks[0]?.command).toContain(
      "PreToolUse",
    );
    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.command).toContain(
      "PostToolUse",
    );
    expect(settings.hooks.PostToolUseFailure[0]?.hooks[0]?.command).toContain(
      "PostToolUseFailure",
    );
    expect(settings.hooks.Notification[0]?.hooks[0]?.command).toContain(
      "Notification",
    );
    expect(settings.hooks.Elicitation[0]?.hooks[0]?.command).toContain(
      "Elicitation",
    );
    expect(settings.hooks.ElicitationResult[0]?.hooks[0]?.command).toContain(
      "ElicitationResult",
    );
    expect(settings.hooks.SubagentStart[0]?.hooks[0]?.command).toContain(
      "SubagentStart",
    );
    expect(settings.hooks.SubagentStop[0]?.hooks[0]?.command).toContain(
      "SubagentStop",
    );
    expect(settings.hooks.TeammateIdle[0]?.hooks[0]?.command).toContain(
      "TeammateIdle",
    );
    expect(settings.hooks.TaskCreated[0]?.hooks[0]?.command).toContain(
      "TaskCreated",
    );
    expect(settings.hooks.TaskCompleted[0]?.hooks[0]?.command).toContain(
      "TaskCompleted",
    );
    expect(settings.hooks.PreCompact[0]?.hooks[0]?.command).toContain(
      "PreCompact",
    );
    expect(settings.hooks.PostCompact[0]?.hooks[0]?.command).toContain(
      "PostCompact",
    );
    expect(settings.hooks.Stop[0]?.hooks[0]?.command).toContain("Stop");
    expect(settings.hooks.StopFailure[0]?.hooks[0]?.command).toContain(
      "StopFailure",
    );
    expect(settings.hooks.SessionEnd[0]?.hooks[0]?.command).toContain(
      "SessionEnd",
    );
  });

  it("writes a reusable settings file for the current user home", () => {
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-with-emotion-hooks-home-"),
    );

    try {
      const settingsFilePath = ensureClaudeHooksSettingsFile(
        "/tmp/helper-bin",
        tempHome,
      );
      const settingsFile = fs.readFileSync(settingsFilePath, "utf8");

      expect(settingsFile).toContain('"SessionStart"');
      expect(settingsFile).toContain("claude-session-hook");
      expect(settingsFile).toContain("UserPromptSubmit");
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
