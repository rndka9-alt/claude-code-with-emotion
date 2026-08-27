import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function writeExecutable(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeLoginShell(pathValue: string): string {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-mcp-shell-"));
  const shellPath = path.join(binDir, "shell");

  // PATH 를 비워둔 채로도 프로브가 성공해야 "로그인 셸 PATH까지 봣지만 claude 가 없다" 는
  // 경로를 실제로 검증할 수 있어서, 가짜 셸은 PATH 탐색이 필요 없는 /bin/sh 로 만든다.
  writeExecutable(
    shellPath,
    `#!/bin/sh
printf %s '${pathValue}'
`,
  );

  return shellPath;
}

function useFakeClaudeBinary(script: string): string {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-mcp-bin-"));

  writeExecutable(path.join(binDir, "claude"), `#!/usr/bin/env node\n${script}`);

  return binDir;
}

async function importUserSetupModule(): Promise<typeof import("./user-setup")> {
  vi.resetModules();
  return import("./user-setup");
}

describe("Claude visual MCP user setup", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("explains when the Claude CLI is not installed", async () => {
    const emptyBinDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-mcp-empty-"),
    );
    process.env.SHELL = createFakeLoginShell(emptyBinDir);
    process.env.PATH = emptyBinDir;

    const { installVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow(
      "Claude Code CLI를 찾지 못햇어요. 앱이 로그인 셸 PATH까지 확인햇지만 `claude` 실행 파일이 없어요.",
    );
  });

  it("explains when the Claude binary cannot run", async () => {
    const binDir = useFakeClaudeBinary(`if (process.argv.includes("--version")) {
  console.error("broken install");
  process.exit(2);
}
process.exit(0);
`);
    process.env.SHELL = createFakeLoginShell(binDir);
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { installVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow("Claude Code CLI는 찾앗지만 `claude --version` 실행에 실패햇어요.");
  });

  it("surfaces the CLI output when the register command fails", async () => {
    const binDir = useFakeClaudeBinary(`if (process.argv.includes("--version")) {
  process.exit(0);
}
if (process.argv.includes("add-json")) {
  console.error("MCP server claude-code-with-emotion-visuals already exists in user config");
  process.exit(1);
}
process.exit(1);
`);
    process.env.SHELL = createFakeLoginShell(binDir);
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { installVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow("already exists in user config");
  });

  it("reports installed when the Claude CLI knows the visual MCP server", async () => {
    const binDir = useFakeClaudeBinary(`if (process.argv.includes("--version")) {
  process.exit(0);
}
if (process.argv.includes("get")) {
  process.stdout.write("claude-code-with-emotion-visuals\\n  Scope: User config\\n");
  process.exit(0);
}
process.exit(1);
`);
    process.env.SHELL = createFakeLoginShell(binDir);
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { getVisualMcpSetupStatus } = await importUserSetupModule();

    expect(getVisualMcpSetupStatus("/tmp/state.json").installed).toBe(true);
  });

  it("reports not installed when the Claude CLI cannot be resolved", async () => {
    const emptyBinDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-mcp-empty-"),
    );
    process.env.SHELL = createFakeLoginShell(emptyBinDir);
    process.env.PATH = emptyBinDir;

    const { getVisualMcpSetupStatus } = await importUserSetupModule();

    expect(getVisualMcpSetupStatus("/tmp/state.json").installed).toBe(false);
  });
});
