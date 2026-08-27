import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function writeExecutable(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

// 프로브가 몇 번 실행댓는지를 모듈 바깥에서 관찰하려고 호출마다 카운터 파일에 한 글자씩 붙인다.
// PATH 를 바꿔가며 검증하는 테스트라 가짜 셸은 PATH 탐색이 필요 없는 /bin/sh 빌트인만 쓴다.
function createCountingLoginShell(body: string): {
  counterPath: string;
  markerPath: string;
  shellPath: string;
} {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "login-shell-path-"));
  const counterPath = path.join(binDir, "count");
  const markerPath = path.join(binDir, "marker");
  const shellPath = path.join(binDir, "shell");

  writeExecutable(
    shellPath,
    `#!/bin/sh
COUNTER='${counterPath}'
MARKER='${markerPath}'
printf 'x' >> "$COUNTER"
${body}
`,
  );

  return { counterPath, markerPath, shellPath };
}

function readProbeCount(counterPath: string): number {
  return fs.readFileSync(counterPath, "utf8").length;
}

async function importLoginShellPathModule(): Promise<
  typeof import("./login-shell-path")
> {
  vi.resetModules();
  return import("./login-shell-path");
}

describe("login shell PATH probe", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("retries the probe after a failure instead of caching it", async () => {
    const { counterPath, shellPath } = createCountingLoginShell(
      `if [ -f "$MARKER" ]; then
  printf '%s' '/recovered-bin'
else
  : > "$MARKER"
  exit 1
fi`,
    );
    process.env.SHELL = shellPath;

    const { resolveLoginShellPath } = await importLoginShellPathModule();

    expect(resolveLoginShellPath()).toBeNull();
    expect(resolveLoginShellPath()).toBe("/recovered-bin");
    expect(readProbeCount(counterPath)).toBe(2);
  });

  it("probes the login shell only once after it succeeds", async () => {
    const { counterPath, shellPath } = createCountingLoginShell(
      `printf '%s' '/probe-bin'`,
    );
    process.env.SHELL = shellPath;

    const { resolveLoginShellPath } = await importLoginShellPathModule();

    expect(resolveLoginShellPath()).toBe("/probe-bin");
    expect(resolveLoginShellPath()).toBe("/probe-bin");
    expect(readProbeCount(counterPath)).toBe(1);
  });

  it("keeps the login shell PATH ahead of the process PATH without duplicates", async () => {
    const { shellPath } = createCountingLoginShell(
      `printf '%s' '${["/login-only", "/shared"].join(path.delimiter)}'`,
    );
    process.env.SHELL = shellPath;
    process.env.PATH = ["/shared", "/process-only"].join(path.delimiter);

    const { getEffectivePath } = await importLoginShellPathModule();

    expect(getEffectivePath()).toBe(
      ["/login-only", "/shared", "/process-only"].join(path.delimiter),
    );
  });

  it("falls back to the process PATH when the probe keeps failing", async () => {
    const { shellPath } = createCountingLoginShell(`exit 1`);
    process.env.SHELL = shellPath;
    process.env.PATH = "/process-only";

    const { getEffectivePath } = await importLoginShellPathModule();

    expect(getEffectivePath()).toBe("/process-only");
  });
});
