import { accessSync, constants } from "node:fs";
import path from "node:path";
import type { HelperBinResolver } from "./helper-bin-resolver";
import { splitPathList } from "./platform-paths";

function isExecutable(pathname: string): boolean {
  try {
    accessSync(pathname, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findPosixExecutableInPath(
  binaryName: string,
  pathValue: string | undefined,
): string | null {
  const segments = splitPathList(pathValue);

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

// POSIX 에선 헬퍼 스크립트가 쉐뱅으로 실행대므로 확장자가 붙지 않는다.
// 윈도우 어댑터가 나중에 ".cmd" shim 이름을 돌려주기 위해 함수를 따로 둔다.
export function getPosixHelperBinFilename(baseName: string): string {
  return baseName;
}

export function createPosixHelperBinResolver(): HelperBinResolver {
  return {
    findExecutableInPath: findPosixExecutableInPath,
    getHelperBinFilename: getPosixHelperBinFilename,
  };
}
