import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createWindowsHelperBinResolver,
  findWindowsExecutableInPath,
  getWindowsHelperBinFilename,
} from "./windows-helper-bin-resolver";

// PATH·PATHEXT 둘 다 윈도우에선 세미콜론. 테스트는 macOS 러너에서 돌지만 세미콜론이 어댑터의 계약.
const WIN_DELIM = ";";

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "win-helper-bin-resolver-"));
}

describe("findWindowsExecutableInPath", () => {
  it("returns the first PATHEXT match across PATH segments", () => {
    const tempRoot = makeTempRoot();
    const first = path.join(tempRoot, "first");
    const second = path.join(tempRoot, "second");

    try {
      fs.mkdirSync(first, { recursive: true });
      fs.mkdirSync(second, { recursive: true });
      // 윈도우는 대소문자 구분이 업어서 반환 경로는 PATHEXT 값의 케이싱(".CMD") 그대로 나온다.
      const targetPath = path.join(second, "zzu-bin.CMD");
      fs.writeFileSync(targetPath, "@echo off\r\necho hi\r\n");

      const pathValue = [first, second].join(WIN_DELIM);
      expect(
        findWindowsExecutableInPath("zzu-bin", pathValue, ".EXE;.CMD"),
      ).toBe(targetPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("tries PATHEXT extensions in order and returns the first match", () => {
    const tempRoot = makeTempRoot();

    try {
      // 같은 디렉터리에 .BAT 과 .CMD 가 모두 존재 → PATHEXT 순서가 .CMD 먼저면 .CMD 가 당첨.
      fs.writeFileSync(path.join(tempRoot, "zzu-bin.BAT"), "");
      const cmdPath = path.join(tempRoot, "zzu-bin.CMD");
      fs.writeFileSync(cmdPath, "");

      expect(
        findWindowsExecutableInPath("zzu-bin", tempRoot, ".CMD;.BAT"),
      ).toBe(cmdPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses the binary name as-is when it already has a PATHEXT extension", () => {
    const tempRoot = makeTempRoot();

    try {
      const targetPath = path.join(tempRoot, "cmd.exe");
      fs.writeFileSync(targetPath, "");
      // "cmd.exe" 는 이미 .EXE 확장자가 붙어잇으니 "cmd.exe.cmd" 같은 걸 시도하지 안아야 댐.
      expect(
        findWindowsExecutableInPath("cmd.exe", tempRoot, ".EXE;.CMD"),
      ).toBe(targetPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("treats PATHEXT matching as case insensitive", () => {
    const tempRoot = makeTempRoot();

    try {
      // 유저가 소문자 `foo.exe` 로 넘기고 PATHEXT 엔 대문자 `.EXE` 만 잇는 상황.
      const targetPath = path.join(tempRoot, "foo.exe");
      fs.writeFileSync(targetPath, "");
      expect(findWindowsExecutableInPath("foo.exe", tempRoot, ".EXE")).toBe(
        targetPath,
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("falls back to default PATHEXT when value is undefined or empty", () => {
    const tempRoot = makeTempRoot();

    try {
      const targetPath = path.join(tempRoot, "zzu-bin.CMD");
      fs.writeFileSync(targetPath, "");
      expect(findWindowsExecutableInPath("zzu-bin", tempRoot, undefined)).toBe(
        targetPath,
      );
      expect(findWindowsExecutableInPath("zzu-bin", tempRoot, "")).toBe(
        targetPath,
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns null when no PATHEXT candidate exists in any segment", () => {
    expect(
      findWindowsExecutableInPath(
        "nope",
        "C:\\nonexistent-a;C:\\nonexistent-b",
        ".EXE;.CMD",
      ),
    ).toBeNull();
  });

  it("returns null when PATH is undefined or empty", () => {
    expect(findWindowsExecutableInPath("zzu", undefined, ".EXE")).toBeNull();
    expect(findWindowsExecutableInPath("zzu", "", ".EXE")).toBeNull();
  });

  it("skips empty segments between consecutive semicolons", () => {
    const tempRoot = makeTempRoot();

    try {
      const targetPath = path.join(tempRoot, "zzu-bin.CMD");
      fs.writeFileSync(targetPath, "");
      const pathValue = `${WIN_DELIM}${WIN_DELIM}${tempRoot}`;
      expect(
        findWindowsExecutableInPath("zzu-bin", pathValue, ".CMD"),
      ).toBe(targetPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("skips directories that happen to match a candidate name", () => {
    const tempRoot = makeTempRoot();

    try {
      // PATHEXT 조합이 디렉터리 이름과 일치하는 괴상한 케이스(`zzu-bin.cmd/`). 파일이 아닌 건 스킵해야 댐.
      fs.mkdirSync(path.join(tempRoot, "zzu-bin.cmd"), { recursive: true });
      expect(
        findWindowsExecutableInPath("zzu-bin", tempRoot, ".CMD"),
      ).toBeNull();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("getWindowsHelperBinFilename", () => {
  it("appends .cmd to the base name for shim lookup", () => {
    expect(getWindowsHelperBinFilename("claude-status")).toBe(
      "claude-status.cmd",
    );
    expect(getWindowsHelperBinFilename("claude-session-hook")).toBe(
      "claude-session-hook.cmd",
    );
  });
});

describe("createWindowsHelperBinResolver", () => {
  it("wires both resolver functions into the adapter interface", () => {
    const resolver = createWindowsHelperBinResolver();

    expect(resolver.getHelperBinFilename("claude-visual-mcp")).toBe(
      "claude-visual-mcp.cmd",
    );
    expect(
      resolver.findExecutableInPath("nope", "C:\\nonexistent"),
    ).toBeNull();
  });
});
