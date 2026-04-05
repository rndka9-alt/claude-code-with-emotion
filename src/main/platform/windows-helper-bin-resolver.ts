import { statSync } from "node:fs";
import path from "node:path";
import type { HelperBinResolver } from "./helper-bin-resolver";

// PATHEXT 가 비어잇을 때 돌릴 최소 공통 분모. cmd.exe 기본값과 동일.
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

// PATH·PATHEXT 둘 다 윈도우에선 세미콜론 구분자. 호스트 OS(macOS 테스트 포함)에 상관업이 고정.
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

function hasExistingPathExt(
  binaryName: string,
  extensions: readonly string[],
): boolean {
  const lowerName = binaryName.toLowerCase();
  return extensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
}

// 이미 PATHEXT 확장자가 붙은 이름(cmd.exe 등)은 그대로만 시도. 아니면 PATHEXT 순서대로 후보 생성.
function getCandidateNames(
  binaryName: string,
  extensions: readonly string[],
): string[] {
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

export function findWindowsExecutableInPath(
  binaryName: string,
  pathValue: string | undefined,
  pathextValue: string | undefined = process.env.PATHEXT,
): string | null {
  const segments = splitWindowsList(pathValue);
  const extensions = parsePathExtensions(pathextValue);

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

// 윈도우는 쉐뱅이 동작하지 안아서 헬퍼마다 .cmd shim 파일을 두고 그 shim 이 node 로 .cjs 를 호출한다.
// 따라서 외부에 노출하는 헬퍼 파일명은 `.cmd` 가 붙은 shim 이름.
export function getWindowsHelperBinFilename(baseName: string): string {
  return `${baseName}.cmd`;
}

export function createWindowsHelperBinResolver(): HelperBinResolver {
  return {
    findExecutableInPath: findWindowsExecutableInPath,
    getHelperBinFilename: getWindowsHelperBinFilename,
  };
}
