import { chmodSync, existsSync, statSync } from "node:fs";
import path from "node:path";

export interface NodePtyHelperPreflightResult {
  foundHelperPaths: string[];
  updatedHelperPaths: string[];
}

export function resolveNodePtySpawnHelperPaths(
  packageRoot: string,
  platform: string,
  arch: string,
): string[] {
  const platformArchDir = `${platform}-${arch}`;

  return [
    path.join(packageRoot, "build", "Release", "spawn-helper"),
    path.join(packageRoot, "prebuilds", platformArchDir, "spawn-helper"),
  ];
}

export function ensureNodePtySpawnHelpersExecutable(
  packageRoot: string,
  platform: string,
  arch: string,
): NodePtyHelperPreflightResult {
  const foundHelperPaths: string[] = [];
  const updatedHelperPaths: string[] = [];

  for (const helperPath of resolveNodePtySpawnHelperPaths(
    packageRoot,
    platform,
    arch,
  )) {
    if (!existsSync(helperPath)) {
      continue;
    }

    foundHelperPaths.push(helperPath);

    const mode = statSync(helperPath).mode;

    if ((mode & 0o111) !== 0o111) {
      // asar unpack 경로는 Electron fs 패치가 read 쪽만 리다이렉트하고 chmod 같은 write 계열은
      // 원본 asar 가상 경로로 내려보내 ENOTDIR 로 실패한다. 번들에 동봉되는 spawn-helper 는
      // 이미 실행 권한을 가진 상태로 패키징되므로 chmod 실패는 무시 가능한 신호로 취급한다.
      try {
        chmodSync(helperPath, mode | 0o111);
        updatedHelperPaths.push(helperPath);
      } catch {
        // noop — 파일이 실제로 실행 불가능하다면 이후 spawn 단계에서 EACCES 로 재감지된다
      }
    }
  }

  return {
    foundHelperPaths,
    updatedHelperPaths,
  };
}
