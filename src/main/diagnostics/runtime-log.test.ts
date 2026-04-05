import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createRuntimeLog,
  formatRuntimeLogLine,
  resolveRuntimeLogPath,
  rotateRuntimeLogIfNeeded,
} from "./runtime-log";

describe("resolveRuntimeLogPath", () => {
  it("uses a workspace path in development", () => {
    expect(resolveRuntimeLogPath("/tmp/app", "/tmp/user-data", false)).toBe(
      "/tmp/app/.runtime-logs/electron-dev.log",
    );
  });

  it("uses the user-data logs path in packaged mode", () => {
    expect(resolveRuntimeLogPath("/tmp/app", "/tmp/user-data", true)).toBe(
      "/tmp/user-data/logs/electron-runtime.log",
    );
  });
});

describe("formatRuntimeLogLine", () => {
  it("formats a timestamped runtime log line", () => {
    expect(
      formatRuntimeLogLine(
        "renderer",
        "booted",
        new Date("2026-04-01T00:00:00.000Z"),
      ),
    ).toBe("[2026-04-01T00:00:00.000Z] [renderer] booted\n");
  });
});

describe("createRuntimeLog", () => {
  it("writes messages and error stacks to disk", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "logs", "runtime.log");
    const runtimeLog = createRuntimeLog(filePath);

    runtimeLog.write("main", "boot");
    runtimeLog.writeError("renderer", new Error("boom"));

    const contents = readFileSync(filePath, "utf8");

    expect(contents).toContain("[main] boot");
    expect(contents).toContain("[renderer] Error: boom");
  });

  it("emits runtime payloads to an optional listener", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "logs", "runtime.log");
    const payloads: Array<{
      message: string;
      scope: string;
      timestamp: string;
    }> = [];
    const runtimeLog = createRuntimeLog(filePath, (payload) => {
      payloads.push(payload);
    });

    runtimeLog.write("assistant-status", "snapshot updated");

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.scope).toBe("assistant-status");
    expect(payloads[0]?.message).toBe("snapshot updated");
    expect(payloads[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("rotateRuntimeLogIfNeeded", () => {
  it("does nothing when the log file is below the size threshold", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    writeFileSync(filePath, "abc", "utf8");

    const rotated = rotateRuntimeLogIfNeeded(filePath, {
      maxBytes: 100,
      maxFiles: 3,
    });

    expect(rotated).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe("abc");
    expect(existsSync(`${filePath}.1`)).toBe(false);
  });

  it("renames the main file to .1 once the threshold is reached", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    writeFileSync(filePath, "0123456789", "utf8");

    const rotated = rotateRuntimeLogIfNeeded(filePath, {
      maxBytes: 10,
      maxFiles: 3,
    });

    expect(rotated).toBe(true);
    expect(existsSync(filePath)).toBe(false);
    expect(readFileSync(`${filePath}.1`, "utf8")).toBe("0123456789");
  });

  it("shifts existing generations forward by one", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    writeFileSync(filePath, "NEW-NEW-NE", "utf8");
    writeFileSync(`${filePath}.1`, "one", "utf8");
    writeFileSync(`${filePath}.2`, "two", "utf8");

    rotateRuntimeLogIfNeeded(filePath, { maxBytes: 10, maxFiles: 3 });

    expect(existsSync(filePath)).toBe(false);
    expect(readFileSync(`${filePath}.1`, "utf8")).toBe("NEW-NEW-NE");
    expect(readFileSync(`${filePath}.2`, "utf8")).toBe("one");
    expect(readFileSync(`${filePath}.3`, "utf8")).toBe("two");
  });

  it("drops the oldest generation beyond maxFiles", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    writeFileSync(filePath, "NEW-NEW-NE", "utf8");
    writeFileSync(`${filePath}.1`, "one", "utf8");
    writeFileSync(`${filePath}.2`, "two", "utf8");
    writeFileSync(`${filePath}.3`, "oldest", "utf8");

    rotateRuntimeLogIfNeeded(filePath, { maxBytes: 10, maxFiles: 3 });

    expect(readFileSync(`${filePath}.1`, "utf8")).toBe("NEW-NEW-NE");
    expect(readFileSync(`${filePath}.2`, "utf8")).toBe("one");
    expect(readFileSync(`${filePath}.3`, "utf8")).toBe("two");
    expect(existsSync(`${filePath}.4`)).toBe(false);
  });

  it("deletes the main file without keeping generations when maxFiles is 0", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    writeFileSync(filePath, "0123456789", "utf8");

    rotateRuntimeLogIfNeeded(filePath, { maxBytes: 10, maxFiles: 0 });

    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(`${filePath}.1`)).toBe(false);
  });

  it("rotates inside createRuntimeLog when appended output crosses the threshold", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "runtime-log-test-"));
    const filePath = path.join(tempDir, "runtime.log");
    const runtimeLog = createRuntimeLog(filePath, undefined, {
      maxBytes: 50,
      maxFiles: 2,
    });

    // 각 라인이 ISO 타임스탬프 포함 대략 50바이트를 쉽게 넘기므로 두 번째 write 전에 회전이 트리거됨
    runtimeLog.write("a", "first-first-first-first-first-first");
    const firstSize = statSync(filePath).size;
    expect(firstSize).toBeGreaterThan(50);

    runtimeLog.write("b", "second");

    expect(existsSync(`${filePath}.1`)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toContain("[b] second");
    expect(readFileSync(filePath, "utf8")).not.toContain("first-first");
  });
});
