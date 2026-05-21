import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ENV_KEYS } from "../../shared/env-keys";

function writeExecutable(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeCommandBin(binaryName: "claude" | "codex" = "claude"): {
  binDir: string;
  statusCallsFilePath: string;
} {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-wrapper-bin-"));
  const statusCallsFilePath = path.join(binDir, "claude-status-calls.jsonl");

  writeExecutable(
    path.join(binDir, binaryName),
    `#!/usr/bin/env node
process.exit(0);
`,
  );

  writeExecutable(
    path.join(binDir, "claude-status"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = process.env.CLAUDE_STATUS_CALLS_FILE;
if (typeof path === "string" && path.length > 0) {
  fs.appendFileSync(path, JSON.stringify(process.argv.slice(2)) + "\\n", "utf8");
}
process.exit(0);
`,
  );

  return {
    binDir,
    statusCallsFilePath,
  };
}

function createFakeCodexBin(featuresListOutput: string): {
  argsFilePath: string;
  binDir: string;
  statusCallsFilePath: string;
} {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-wrapper-bin-"));
  const argsFilePath = path.join(binDir, "codex-args.jsonl");
  const statusCallsFilePath = path.join(binDir, "claude-status-calls.jsonl");

  writeExecutable(
    path.join(binDir, "codex"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const argsFilePath = process.env.CODEX_ARGS_FILE;
if (typeof argsFilePath === "string" && argsFilePath.length > 0) {
  fs.appendFileSync(argsFilePath, JSON.stringify(process.argv.slice(2)) + "\\n", "utf8");
}
const args = process.argv.slice(2);
if (args.includes("--version")) {
  process.stdout.write("codex-cli 0.132.0\\n");
  process.exit(0);
}
if (args[0] === "features" && args[1] === "list") {
  process.stdout.write(${JSON.stringify(featuresListOutput)});
  process.exit(0);
}
process.exit(0);
`,
  );

  writeExecutable(
    path.join(binDir, "claude-status"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = process.env.CLAUDE_STATUS_CALLS_FILE;
if (typeof path === "string" && path.length > 0) {
  fs.appendFileSync(path, JSON.stringify(process.argv.slice(2)) + "\\n", "utf8");
}
process.exit(0);
`,
  );

  return {
    argsFilePath,
    binDir,
    statusCallsFilePath,
  };
}

function readStatusCalls(statusCallsFilePath: string): string[][] {
  const lines = fs.readFileSync(statusCallsFilePath, "utf8").trim().split("\n");

  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const parsed: unknown = JSON.parse(line);

      if (
        !Array.isArray(parsed) ||
        !parsed.every((entry) => typeof entry === "string")
      ) {
        throw new Error(
          "Expected claude-status call log to contain string arrays",
        );
      }

      return parsed;
    });
}

function readJsonLines(filePath: string): string[][] {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");

  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const parsed: unknown = JSON.parse(line);

      if (
        !Array.isArray(parsed) ||
        !parsed.every((entry) => typeof entry === "string")
      ) {
        throw new Error("Expected JSON lines to contain string arrays");
      }

      return parsed;
    });
}

function readFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((entry) => entry === flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return typeof value === "string" ? value : null;
}

describe("claude wrapper", () => {
  it("publishes disconnected after a clean Claude exit", () => {
    const { binDir, statusCallsFilePath } = createFakeCommandBin();
    const result = spawnSync("node", ["./bin/claude"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
        [ENV_KEYS.ORIGINAL_PATH]: `${binDir}:${process.env.PATH ?? ""}`,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const statusCalls = readStatusCalls(statusCallsFilePath);
    const finalCall = statusCalls.at(-1);

    expect(finalCall).toBeDefined();
    expect(readFlagValue(finalCall ?? [], "--state")).toBe("disconnected");
    expect(readFlagValue(finalCall ?? [], "--task")).toBe(
      "Waiting for Claude to start",
    );
    expect(readFlagValue(finalCall ?? [], "--line")).toBe(
      "Claude 세션이 종료돼서 지금은 미연결 상태예요...!",
    );
  });
});

describe("codex wrapper", () => {
  it("publishes disconnected after a clean Codex CLI exit", () => {
    const { binDir, statusCallsFilePath } = createFakeCommandBin("codex");
    const result = spawnSync("node", ["./bin/codex"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
        [ENV_KEYS.ORIGINAL_PATH]: `${binDir}:${process.env.PATH ?? ""}`,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const statusCalls = readStatusCalls(statusCallsFilePath);
    const firstCall = statusCalls.at(0);
    const finalCall = statusCalls.at(-1);

    expect(firstCall).toBeDefined();
    expect(readFlagValue(firstCall ?? [], "--task")).toBe(
      "Running Codex CLI in the active terminal",
    );
    expect(finalCall).toBeDefined();
    expect(readFlagValue(finalCall ?? [], "--state")).toBe("disconnected");
    expect(readFlagValue(finalCall ?? [], "--task")).toBe(
      "Waiting for Codex CLI to start",
    );
    expect(readFlagValue(finalCall ?? [], "--line")).toBe(
      "Codex CLI 세션이 종료돼서 지금은 미연결 상태예요...!",
    );
  });

  it("injects runtime hook config when Codex hooks are enabled", () => {
    const { argsFilePath, binDir, statusCallsFilePath } = createFakeCodexBin(
      "hooks stable true\n",
    );
    const result = spawnSync("node", ["./bin/codex"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
        CODEX_ARGS_FILE: argsFilePath,
        [ENV_KEYS.ORIGINAL_PATH]: `${binDir}:${process.env.PATH ?? ""}`,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const codexCalls = readJsonLines(argsFilePath);
    const launchArgs = codexCalls.at(-1) ?? [];

    expect(launchArgs).toContain("-c");
    expect(launchArgs.join("\n")).toContain("hooks.SessionStart=");
    expect(launchArgs.join("\n")).toContain("hooks.UserPromptSubmit=");
    expect(launchArgs.join("\n")).toContain("hooks.PermissionRequest=");
    expect(launchArgs.join("\n")).toContain("hooks.PreCompact=");
    expect(launchArgs.join("\n")).toContain("hooks.PostCompact=");
    expect(launchArgs.join("\n")).toContain("codex-hook");
    expect(launchArgs.join("\n")).toContain(
      "--source claude-code-with-emotion",
    );
    expect(launchArgs.join("\n")).toContain(
      "Syncing claude-code-with-emotion status",
    );

    const statusCalls = readStatusCalls(statusCallsFilePath);

    expect(
      statusCalls.some((call) => {
        return (
          readFlagValue(call, "--task") === "Codex hook runtime config injected"
        );
      }),
    ).toBe(true);
  });

  it("keeps launching Codex without hook config when hooks are disabled", () => {
    const { argsFilePath, binDir, statusCallsFilePath } = createFakeCodexBin(
      "hooks stable false\n",
    );
    const result = spawnSync("node", ["./bin/codex"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
        CODEX_ARGS_FILE: argsFilePath,
        [ENV_KEYS.ORIGINAL_PATH]: `${binDir}:${process.env.PATH ?? ""}`,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const codexCalls = readJsonLines(argsFilePath);
    const launchArgs = codexCalls.at(-1) ?? [];

    expect(launchArgs.join("\n")).not.toContain("hooks.SessionStart=");

    const statusCalls = readStatusCalls(statusCallsFilePath);

    expect(
      statusCalls.some((call) => {
        return (
          readFlagValue(call, "--task") === "Codex hooks feature is disabled"
        );
      }),
    ).toBe(true);
  });

  it("publishes hook event status updates without writing hook stdout", () => {
    const { binDir, statusCallsFilePath } = createFakeCommandBin("codex");
    const result = spawnSync("node", ["./bin/codex-hook"], {
      cwd: process.cwd(),
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
      }),
      env: {
        ...process.env,
        CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");

    const statusCalls = readStatusCalls(statusCallsFilePath);
    const finalCall = statusCalls.at(-1);

    expect(finalCall).toBeDefined();
    expect(readFlagValue(finalCall ?? [], "--state")).toBe("working");
    expect(readFlagValue(finalCall ?? [], "--task")).toBe(
      "Codex tool use is starting: Bash",
    );
  });

  it("maps Codex permission and compaction events to existing visual states", () => {
    const { binDir, statusCallsFilePath } = createFakeCommandBin("codex");
    const hookEvents = [
      {
        eventName: "PermissionRequest",
        expectedState: "permission_wait",
      },
      {
        eventName: "PreCompact",
        expectedState: "compacting",
      },
      {
        eventName: "PostCompact",
        expectedState: "completed",
      },
    ];

    for (const hookEvent of hookEvents) {
      const result = spawnSync("node", ["./bin/codex-hook"], {
        cwd: process.cwd(),
        input: JSON.stringify({
          hook_event_name: hookEvent.eventName,
        }),
        env: {
          ...process.env,
          CLAUDE_STATUS_CALLS_FILE: statusCallsFilePath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
    }

    const statusCalls = readStatusCalls(statusCallsFilePath);

    for (const hookEvent of hookEvents) {
      expect(
        statusCalls.some((call) => {
          return readFlagValue(call, "--state") === hookEvent.expectedState;
        }),
      ).toBe(true);
    }
  });
});
