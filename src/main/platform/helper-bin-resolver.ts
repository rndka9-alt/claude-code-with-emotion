import { createPosixHelperBinResolver } from "./posix-helper-bin-resolver";

// 번들 헬퍼 스크립트(ours) 의 파일명, 그리고 외부 바이너리(claude 등) 의 PATH 탐색은
// 플랫폼마다 확장자·실행 가능성 판단 규칙이 다르다. 이 어댑터가 그 차이를 흡수한다.
export interface HelperBinResolver {
  // 외부 바이너리를 PATH 에서 찾는다. 플랫폼별 확장자 후보(POSIX: 그대로, 윈도우: .exe/.cmd 등)를 시도.
  findExecutableInPath(
    binaryName: string,
    pathValue: string | undefined,
  ): string | null;

  // 우리가 번들하는 헬퍼 스크립트 이름. POSIX 는 그대로, 윈도우는 .cmd shim 이름으로 돌려준다.
  getHelperBinFilename(baseName: string): string;
}

// 현재는 POSIX 만 구현. 윈도우 어댑터는 후속 작업에서 추가.
export function getPlatformHelperBinResolver(): HelperBinResolver {
  return createPosixHelperBinResolver();
}
