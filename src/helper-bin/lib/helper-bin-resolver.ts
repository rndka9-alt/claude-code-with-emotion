import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

// bin 헬퍼는 별도 Node 프로세스로 실행되어 Electron 의 asar require 패치를 못 쓴다.
// 외부 바이너리(claude 등)의 PATH 탐색과 우리 헬퍼 파일명 규칙은 플랫폼마다 달라서
// 이 모듈이 그 차이를 흡수한다. 윈도우·POSIX 대응은 두 분기를 함께 손봐야 한다.
// 단, 윈도우 분기는 best-effort 로만 존재하며 유지보수·검증되지 않는다(CLAUDE.md Platform Support 참고).

const IS_WINDOWS = process.platform === "win32";

// --- POSIX ---

function splitPosixPathList(value: string | undefined): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(path.delimiter);
}

function isExecutable(pathname: string): boolean {
  try {
    accessSync(pathname, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findPosixExecutableInPath(
  binaryName: string,
  pathValue: string | undefined,
): string | null {
  const segments = splitPosixPathList(pathValue);

  for (const segment of segments) {
    if (segment.length === 0) {
      continue;
    }

    const candidate = path.join(segment, binaryName);

    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getPosixHelperBinFilename(baseName: string): string {
  return baseName;
}

// --- Windows ---

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";
const WINDOWS_LIST_DELIMITER = ";";

function splitWindowsList(value: string | undefined): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(WINDOWS_LIST_DELIMITER);
}

function parsePathExtensions(pathextValue: string | undefined): string[] {
  const raw =
    typeof pathextValue === "string" && pathextValue.length > 0
      ? pathextValue
      : DEFAULT_PATHEXT;

  return splitWindowsList(raw).filter((ext) => ext.length > 0);
}

function hasExistingPathExt(binaryName: string, extensions: string[]): boolean {
  const lowerName = binaryName.toLowerCase();
  return extensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
}

function getCandidateNames(binaryName: string, extensions: string[]): string[] {
  if (hasExistingPathExt(binaryName, extensions)) {
    return [binaryName];
  }
  return extensions.map((ext) => `${binaryName}${ext}`);
}

function isRegularFile(pathname: string): boolean {
  try {
    return statSync(pathname).isFile();
  } catch {
    return false;
  }
}

function findWindowsExecutableInPath(
  binaryName: string,
  pathValue: string | undefined,
): string | null {
  const segments = splitWindowsList(pathValue);
  const extensions = parsePathExtensions(process.env.PATHEXT);

  for (const segment of segments) {
    if (segment.length === 0) {
      continue;
    }

    for (const candidate of getCandidateNames(binaryName, extensions)) {
      const fullPath = path.join(segment, candidate);

      if (isRegularFile(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

function getWindowsHelperBinFilename(baseName: string): string {
  return `${baseName}.cmd`;
}

// --- Platform dispatch ---

export const findExecutableInPath = IS_WINDOWS
  ? findWindowsExecutableInPath
  : findPosixExecutableInPath;

export const getHelperBinFilename = IS_WINDOWS
  ? getWindowsHelperBinFilename
  : getPosixHelperBinFilename;

export const splitPathList = IS_WINDOWS ? splitWindowsList : splitPosixPathList;
