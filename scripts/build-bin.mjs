import * as esbuild from "esbuild";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// helper-bin 헬퍼는 Claude/Codex CLI 의 hook·MCP 설정을 통해 외부 Node 프로세스로
// execve 된다. Electron 의 asar require 패치를 못 쓰므로, src/shared 의 공유 로직과
// zod 같은 의존성을 각 entry 에 인라인한 self-contained 단일 파일로 번들한다.

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const sourceDir = path.join(projectRoot, "src", "helper-bin");
const outDir = path.join(projectRoot, "bin");
const watch = process.argv.includes("--watch");

// PATH 에 확장자 업는 이름으로 노출되는 entry 들. lib/prompts 는 번들에 인라인된다.
const ENTRY_NAMES = [
  "claude",
  "codex",
  "claude-status",
  "claude-visual-mcp",
  "claude-visual-state",
  "claude-session-hook",
  "codex-hook",
];

function makeExecutablePlugin(outFile) {
  return {
    name: "make-executable",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          chmodSync(outFile, 0o755);
        }
      });
    },
  };
}

function makeConfig(name) {
  const outFile = path.join(outDir, name);

  return {
    entryPoints: [path.join(sourceDir, `${name}.ts`)],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    // prod 빌드는 minify 로 self-contained 번들 크기를 줄인다(zod 등 인라인 의존성 포함).
    // watch(dev) 에선 재빌드 속도를 위해 끈다.
    minify: !watch,
    // 외부 프로세스로 직접 실행되므로 shebang 을 붙인다.
    banner: { js: "#!/usr/bin/env node" },
    // prompt 본문을 문자열로 인라인 (번들 후 __dirname 경로 의존 제거).
    loader: { ".md": "text" },
    logLevel: "info",
    plugins: [makeExecutablePlugin(outFile)],
  };
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Windows PATH shim: 확장자 업는 헬퍼를 node 로 실행한다.
// (윈도우는 best-effort·미유지보수 — CLAUDE.md Platform Support)
for (const name of ENTRY_NAMES) {
  writeFileSync(
    path.join(outDir, `${name}.cmd`),
    `@echo off\nnode "%~dp0${name}" %*\n`,
  );
}

const configs = ENTRY_NAMES.map(makeConfig);

if (watch) {
  const contexts = await Promise.all(
    configs.map((config) => esbuild.context(config)),
  );

  await Promise.all(contexts.map((context) => context.watch()));
  console.log("[build-bin] watching helper-bin sources…");
} else {
  await Promise.all(configs.map((config) => esbuild.build(config)));
  console.log(`[build-bin] built ${ENTRY_NAMES.length} helper-bin entries`);
}
