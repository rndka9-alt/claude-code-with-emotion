import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearStaleTerminalOutputLogs } from "./session-artifacts";

const DAY_MS = 24 * 60 * 60 * 1000;

function setFileModifiedAt(filePath: string, modifiedAtMs: number): void {
  const seconds = modifiedAtMs / 1000;

  fs.utimesSync(filePath, seconds, seconds);
}

describe("clearStaleTerminalOutputLogs", () => {
  it("removes logs past the retention window and keeps recent ones", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-terminal-output-cleanup-"),
    );
    const nowMs = Date.now();
    const staleLogPath = path.join(tempDir, "session-old.log");
    const staleRotatedPath = path.join(tempDir, "session-old.log.1");
    const freshLogPath = path.join(tempDir, "session-live.log");
    const nestedDirPath = path.join(tempDir, "nested");
    const messages: string[] = [];

    try {
      fs.writeFileSync(staleLogPath, "stale", "utf8");
      fs.writeFileSync(staleRotatedPath, "stale rotated", "utf8");
      fs.writeFileSync(freshLogPath, "fresh", "utf8");
      fs.mkdirSync(nestedDirPath);
      setFileModifiedAt(staleLogPath, nowMs - 8 * DAY_MS);
      setFileModifiedAt(staleRotatedPath, nowMs - 8 * DAY_MS);

      clearStaleTerminalOutputLogs(
        tempDir,
        (message) => {
          messages.push(message);
        },
        nowMs,
      );

      expect(fs.existsSync(staleLogPath)).toBe(false);
      expect(fs.existsSync(staleRotatedPath)).toBe(false);
      expect(fs.existsSync(freshLogPath)).toBe(true);
      expect(fs.existsSync(nestedDirPath)).toBe(true);
      expect(
        messages.filter((message) =>
          message.includes("removed session artifact"),
        ),
      ).toHaveLength(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does nothing when the directory does not exist", () => {
    const missingDir = path.join(
      os.tmpdir(),
      "claude-terminal-output-cleanup-missing",
    );
    const messages: string[] = [];

    expect(() => {
      clearStaleTerminalOutputLogs(missingDir, (message) => {
        messages.push(message);
      });
    }).not.toThrow();
    expect(messages).toHaveLength(0);
  });
});
