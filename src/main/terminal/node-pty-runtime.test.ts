import { mkdtempSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ensureNodePtySpawnHelpersExecutable,
  resolveNodePtySpawnHelperPaths,
} from "./node-pty-runtime";

describe("resolveNodePtySpawnHelperPaths", () => {
  it("returns build and prebuild helper candidates for the current platform tuple", () => {
    const paths = resolveNodePtySpawnHelperPaths(
      "/tmp/node-pty",
      "darwin",
      "arm64",
    );

    expect(paths).toEqual([
      "/tmp/node-pty/build/Release/spawn-helper",
      "/tmp/node-pty/prebuilds/darwin-arm64/spawn-helper",
    ]);
  });
});

describe("ensureNodePtySpawnHelpersExecutable", () => {
  it("adds execute bits to discovered helper binaries", () => {
    const packageRoot = mkdtempSync(
      path.join(os.tmpdir(), "node-pty-runtime-"),
    );
    const helperDir = path.join(packageRoot, "prebuilds", "darwin-arm64");
    const helperPath = path.join(helperDir, "spawn-helper");

    mkdirSync(helperDir, { recursive: true });
    writeFileSync(helperPath, "helper");

    const result = ensureNodePtySpawnHelpersExecutable(
      packageRoot,
      "darwin",
      "arm64",
    );
    const mode = statSync(helperPath).mode & 0o777;

    expect(result.foundHelperPaths).toEqual([helperPath]);
    expect(result.updatedHelperPaths).toEqual([helperPath]);
    expect(mode).toBe(0o755);
  });
});
