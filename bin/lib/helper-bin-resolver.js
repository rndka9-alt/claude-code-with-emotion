const { accessSync, constants, statSync } = require("node:fs");
const path = require("node:path");

// bin/ 스크립트는 .cjs 라 TS 어댑터(src/main/platform/helper-bin-resolver.ts) 를 임포트할 수 업다.
// 같은 로직을 이 파일에서 복제해서 사용한다. 윈도우·POSIX 대응은 두 곳 모두 손봐야 한다.

const IS_WINDOWS = process.platform === "win32";

// --- POSIX ---

function splitPosixPathList(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(path.delimiter);
}

function isExecutable(pathname) {
  try {
    accessSync(pathname, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findPosixExecutableInPath(binaryName, pathValue) {
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

function getPosixHelperBinFilename(baseName) {
  return baseName;
}

// --- Windows ---

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";
const WINDOWS_LIST_DELIMITER = ";";

function splitWindowsList(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(WINDOWS_LIST_DELIMITER);
}

function parsePathExtensions(pathextValue) {
  const raw =
    typeof pathextValue === "string" && pathextValue.length > 0
      ? pathextValue
      : DEFAULT_PATHEXT;

  return splitWindowsList(raw).filter((ext) => ext.length > 0);
}

function hasExistingPathExt(binaryName, extensions) {
  const lowerName = binaryName.toLowerCase();
  return extensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
}

function getCandidateNames(binaryName, extensions) {
  if (hasExistingPathExt(binaryName, extensions)) {
    return [binaryName];
  }
  return extensions.map((ext) => `${binaryName}${ext}`);
}

function isRegularFile(pathname) {
  try {
    return statSync(pathname).isFile();
  } catch {
    return false;
  }
}

function findWindowsExecutableInPath(binaryName, pathValue) {
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

function getWindowsHelperBinFilename(baseName) {
  return `${baseName}.cmd`;
}

// --- Platform dispatch ---

const findExecutableInPath = IS_WINDOWS
  ? findWindowsExecutableInPath
  : findPosixExecutableInPath;

const getHelperBinFilename = IS_WINDOWS
  ? getWindowsHelperBinFilename
  : getPosixHelperBinFilename;

const splitPathList = IS_WINDOWS ? splitWindowsList : splitPosixPathList;

module.exports = {
  findExecutableInPath,
  getHelperBinFilename,
  splitPathList,
};
