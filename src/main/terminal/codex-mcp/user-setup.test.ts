import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function writeExecutable(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeLoginShell(pathValue: string): string {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-shell-"));
  const shellPath = path.join(binDir, "shell");

  writeExecutable(
    shellPath,
    `#!/usr/bin/env node
process.stdout.write(${JSON.stringify(pathValue)});
`,
  );

  return shellPath;
}

async function importUserSetupModule(): Promise<typeof import("./user-setup")> {
  vi.resetModules();
  return import("./user-setup");
}

describe("Codex visual MCP user setup", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("explains when Codex CLI is not installed", async () => {
    const emptyBinDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "codex-mcp-empty-"),
    );
    process.env.SHELL = createFakeLoginShell(emptyBinDir);
    process.env.PATH = emptyBinDir;

    const { installCodexVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installCodexVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow(
      "Codex CLI를 찾지 못햇어요. 앱이 로그인 셸 PATH까지 확인햇지만 `codex` 실행 파일이 없어요.",
    );
  });

  it("explains when the Codex binary cannot run", async () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-bin-"));
    writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  console.error("broken install");
  process.exit(2);
}
process.exit(0);
`,
    );
    process.env.SHELL = createFakeLoginShell(
      `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`,
    );
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { installCodexVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installCodexVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow("Codex CLI는 찾앗지만 `codex --version` 실행에 실패햇어요.");
  });

  it("reports installed only when Codex MCP points at the current helper", async () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-bin-"));
    writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.exit(0);
}
if (process.argv.includes("get")) {
  process.stdout.write("claude-code-with-emotion-visuals\\n  command: /tmp/helper-bin/claude-visual-mcp\\n");
  process.exit(0);
}
process.exit(1);
`,
    );
    process.env.SHELL = createFakeLoginShell(
      `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`,
    );
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { getCodexVisualMcpSetupStatus } = await importUserSetupModule();

    expect(
      getCodexVisualMcpSetupStatus("/tmp/helper-bin", "/tmp/state.json")
        .installed,
    ).toBe(true);
  });

  it("treats stale Codex MCP command paths as not installed", async () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-bin-"));
    writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.exit(0);
}
if (process.argv.includes("get")) {
  process.stdout.write("claude-code-with-emotion-visuals\\n  command: /Applications/Claude Code With Emotion.app/Contents/Resources/bin/claude-visual-mcp\\n");
  process.exit(0);
}
process.exit(1);
`,
    );
    process.env.SHELL = createFakeLoginShell(
      `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`,
    );
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { getCodexVisualMcpSetupStatus } = await importUserSetupModule();

    expect(
      getCodexVisualMcpSetupStatus("/tmp/helper-bin", "/tmp/state.json")
        .installed,
    ).toBe(false);
  });

  it("includes Codex mcp command output when registration fails", async () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-bin-"));
    writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.exit(0);
}
if (process.argv.includes("remove")) {
  console.error("No MCP server found");
  process.exit(1);
}
if (process.argv.includes("add")) {
  console.error("permission denied for codex config");
  process.exit(2);
}
process.exit(1);
`,
    );
    process.env.SHELL = createFakeLoginShell(
      `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`,
    );
    process.env.PATH = `${binDir}${path.delimiter}${originalEnv.PATH ?? ""}`;

    const { installCodexVisualMcpUserSetup } = await importUserSetupModule();

    expect(() => {
      installCodexVisualMcpUserSetup("/tmp/helper-bin", "/tmp/state.json");
    }).toThrow(
      "Codex CLI는 찾앗지만 Visual MCP 등록 명령이 실패햇어요. `codex mcp add claude-code-with-emotion-visuals` 출력: permission denied for codex config",
    );
  });
});
