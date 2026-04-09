import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeExecutable(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeCommandBin(): {
  binDir: string;
  statusCallsFilePath: string;
} {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-wrapper-bin-"));
  const statusCallsFilePath = path.join(binDir, "claude-status-calls.jsonl");

  writeExecutable(
    path.join(binDir, "claude"),
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

function readStatusCalls(statusCallsFilePath: string): string[][] {
  const lines = fs.readFileSync(statusCallsFilePath, "utf8").trim().split("\n");

  return lines.filter((line) => line.length > 0).map((line) => {
    const parsed: unknown = JSON.parse(line);

    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error("Expected claude-status call log to contain string arrays");
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
        CLAUDE_WITH_EMOTION_ORIGINAL_PATH: `${binDir}:${process.env.PATH ?? ""}`,
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
