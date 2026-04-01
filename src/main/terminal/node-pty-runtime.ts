import { chmodSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

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
    path.join(packageRoot, 'build', 'Release', 'spawn-helper'),
    path.join(packageRoot, 'prebuilds', platformArchDir, 'spawn-helper'),
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
      chmodSync(helperPath, mode | 0o111);
      updatedHelperPaths.push(helperPath);
    }
  }

  return {
    foundHelperPaths,
    updatedHelperPaths,
  };
}
