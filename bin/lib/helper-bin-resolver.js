const { accessSync, constants } = require("node:fs");
const path = require("node:path");

// bin/ 스크립트는 .cjs 라 TS 어댑터(src/main/platform/helper-bin-resolver.ts) 를 임포트할 수 업다.
// 같은 로직을 이 파일에서 복제해서 사용한다. 윈도우 대응은 두 곳 모두 손봐야 한다.

function splitPathList(value) {
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

function findExecutableInPath(binaryName, pathValue) {
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

function getHelperBinFilename(baseName) {
  // POSIX 는 쉐뱅 기반 실행이라 확장자 없음. 윈도우에선 .cmd shim 이름을 돌려줘야 함(미구현).
  return baseName;
}

module.exports = {
  findExecutableInPath,
  getHelperBinFilename,
  splitPathList,
};
