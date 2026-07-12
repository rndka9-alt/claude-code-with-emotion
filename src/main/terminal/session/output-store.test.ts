import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TerminalOutputStore } from "./output-store";

const ROTATION_MAX_BYTES = 8 * 1024 * 1024;
const FLUSH_THRESHOLD_CHARS = 256 * 1024;

function createTempStore(): {
  filePath: string;
  store: TerminalOutputStore;
  tempDir: string;
} {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "claude-terminal-output-store-"),
  );
  const filePath = path.join(tempDir, "session-1.log");

  return { filePath, store: new TerminalOutputStore(filePath), tempDir };
}

describe("TerminalOutputStore", () => {
  it("appends output to the log file and tracks versions", () => {
    const { filePath, store, tempDir } = createTempStore();

    try {
      store.reset();
      expect(store.getVersion()).toBe(0);
      expect(fs.readFileSync(filePath, "utf8")).toBe("");

      expect(store.append("hello")).toBe(1);
      expect(store.append(" world")).toBe(2);
      expect(store.getVersion()).toBe(2);

      store.dispose();

      expect(fs.readFileSync(filePath, "utf8")).toBe("hello world");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("flushes immediately once buffered output passes the threshold", () => {
    const { filePath, store, tempDir } = createTempStore();

    try {
      store.reset();
      store.append("x".repeat(FLUSH_THRESHOLD_CHARS));

      expect(fs.statSync(filePath).size).toBe(FLUSH_THRESHOLD_CHARS);
    } finally {
      store.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rotates the log file after it reaches the size cap", () => {
    const { filePath, store, tempDir } = createTempStore();

    try {
      store.reset();
      store.append("x".repeat(ROTATION_MAX_BYTES));
      store.append("next");
      store.dispose();

      expect(fs.readFileSync(filePath, "utf8")).toBe("next");
      expect(fs.statSync(`${filePath}.1`).size).toBe(ROTATION_MAX_BYTES);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reset truncates the log and removes the rotated generation", () => {
    const { filePath, store, tempDir } = createTempStore();

    try {
      store.reset();
      store.append("x".repeat(ROTATION_MAX_BYTES));
      store.append("next");
      store.dispose();
      expect(fs.existsSync(`${filePath}.1`)).toBe(true);

      store.reset();

      expect(store.getVersion()).toBe(0);
      expect(fs.readFileSync(filePath, "utf8")).toBe("");
      expect(fs.existsSync(`${filePath}.1`)).toBe(false);
    } finally {
      store.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
