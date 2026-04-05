import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPosixHelperBinResolver,
  findPosixExecutableInPath,
  getPosixHelperBinFilename,
} from "./posix-helper-bin-resolver";

describe("findPosixExecutableInPath", () => {
  it("returns the first executable match across PATH segments", () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "helper-bin-resolver-"),
    );
    const first = path.join(tempRoot, "first");
    const second = path.join(tempRoot, "second");

    try {
      fs.mkdirSync(first, { recursive: true });
      fs.mkdirSync(second, { recursive: true });
      const targetPath = path.join(second, "zzu-bin");
      fs.writeFileSync(targetPath, "#!/bin/sh\necho hi\n", { mode: 0o755 });

      const pathValue = [first, second].join(path.delimiter);
      expect(findPosixExecutableInPath("zzu-bin", pathValue)).toBe(targetPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns null when no segment contains the binary", () => {
    expect(findPosixExecutableInPath("nope", "/nonexistent-a:/nonexistent-b")).toBeNull();
  });

  it("returns null when PATH is undefined or empty", () => {
    expect(findPosixExecutableInPath("zzu", undefined)).toBeNull();
    expect(findPosixExecutableInPath("zzu", "")).toBeNull();
  });

  it("skips empty segments such as consecutive delimiters", () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "helper-bin-resolver-"),
    );

    try {
      const targetPath = path.join(tempRoot, "zzu-bin");
      fs.writeFileSync(targetPath, "#!/bin/sh\n", { mode: 0o755 });
      const pathValue = `${path.delimiter}${path.delimiter}${tempRoot}`;
      expect(findPosixExecutableInPath("zzu-bin", pathValue)).toBe(targetPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("skips files that are not marked executable", () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "helper-bin-resolver-"),
    );

    try {
      const targetPath = path.join(tempRoot, "zzu-bin");
      fs.writeFileSync(targetPath, "nope", { mode: 0o644 });
      expect(findPosixExecutableInPath("zzu-bin", tempRoot)).toBeNull();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("getPosixHelperBinFilename", () => {
  it("returns the base name unchanged on POSIX", () => {
    expect(getPosixHelperBinFilename("claude-status")).toBe("claude-status");
    expect(getPosixHelperBinFilename("claude-session-hook")).toBe(
      "claude-session-hook",
    );
  });
});

describe("createPosixHelperBinResolver", () => {
  it("wires both resolver functions into the adapter interface", () => {
    const resolver = createPosixHelperBinResolver();

    expect(resolver.getHelperBinFilename("claude-visual-mcp")).toBe(
      "claude-visual-mcp",
    );
    expect(resolver.findExecutableInPath("nope", "/nonexistent")).toBeNull();
  });
});
