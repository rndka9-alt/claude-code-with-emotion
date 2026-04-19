import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as asar from "@electron/asar";

const APP_NAME = "Claude Code With Emotion";
const APP_IDENTIFIER = "studio.moodlamp.claude-code-with-emotion";

function replacePlistValue(contents, key, value) {
  const pattern = new RegExp(
    `<key>${key}</key>\\s*<string>[^<]*</string>`,
    "m",
  );

  return contents.replace(
    pattern,
    `<key>${key}</key>\n\t<string>${value}</string>`,
  );
}

// Electron.app 번들 복사엔 macOS 네이티브 ditto 를 사용한다.
// Node cpSync 는 pnpm 의 중첩 심볼릭 링크를 거치면서 프레임워크 내부 상대 링크를
// 절대 경로로 리졸브해 복사해버려, Electron Framework 안의 icudtl.dat 등이 사라진다.
// ditto 는 macOS 번들(심볼릭 링크·리소스 포크·메타데이터 포함)을 원본 그대로 보존한다.
function copyAppBundle(source, destination) {
  execFileSync("ditto", [source, destination], { stdio: "inherit" });
}

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const distDir = path.join(projectRoot, "dist");
const electronAppTemplatePath = path.join(
  projectRoot,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
);
const outputDir = path.join(distDir, "macos");
const bundlePath = path.join(outputDir, `${APP_NAME}.app`);
const resourcesPath = path.join(bundlePath, "Contents", "Resources");
const executableDir = path.join(bundlePath, "Contents", "MacOS");
const infoPlistPath = path.join(bundlePath, "Contents", "Info.plist");
const customIconPath = path.join(projectRoot, "assets", "icon.icns");
const bundleIconPath = path.join(resourcesPath, "electron.icns");
const defaultAppAsarPath = path.join(resourcesPath, "default_app.asar");
const stagingDir = path.join(distDir, "staging");
const asarPath = path.join(resourcesPath, "app.asar");

if (!existsSync(electronAppTemplatePath)) {
  throw new Error(
    'Electron.app template was not found. Run "pnpm install" before packaging.',
  );
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyAppBundle(electronAppTemplatePath, bundlePath);

// Electron 템플릿이 기본으로 싣는 default_app.asar 는 "앱이 없을 때 보여주는 환영창"이라
// 우리 app.asar 를 넣은 뒤에도 남아잇으면 리소스 낭비가 된다.
if (existsSync(defaultAppAsarPath)) {
  rmSync(defaultAppAsarPath, { force: true });
}

const executableSource = path.join(executableDir, "Electron");
const executableTarget = path.join(executableDir, APP_NAME);

renameSync(executableSource, executableTarget);
chmodSync(executableTarget, 0o755);

const infoPlist = readFileSync(infoPlistPath, "utf8");
const updatedPlist = [
  ["CFBundleDisplayName", APP_NAME],
  ["CFBundleExecutable", APP_NAME],
  ["CFBundleIdentifier", APP_IDENTIFIER],
  ["CFBundleName", APP_NAME],
].reduce((contents, [key, value]) => {
  return replacePlistValue(contents, key, value);
}, infoPlist);

writeFileSync(infoPlistPath, updatedPlist, "utf8");

// Electron 템플릿의 electron.icns 자리를 그대로 덮어씀 — Info.plist의 CFBundleIconFile 키를 건드리지 않아도 돼서 단순함
if (existsSync(customIconPath)) {
  copyFileSync(customIconPath, bundleIconPath);
}

// --- asar 아카이브용 staging 디렉터리 구성 ---
// 런타임에 실제로 필요한 파일만 모아서 asar 로 패키징한다.
// renderer 측 의존성(react, xterm, lucide-react)은 vite 가 dist/renderer 번들에 흡수햇기 때문에
// node_modules 에 남겨둘 외부 패키지는 main 이 require 하는 node-pty, zod 뿐이다.
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

const runtimePackageJson = {
  name: "claude-code-with-emotion",
  version: "0.1.0",
  main: "dist/main/index.js",
  productName: APP_NAME,
};

writeFileSync(
  path.join(stagingDir, "package.json"),
  `${JSON.stringify(runtimePackageJson, null, 2)}\n`,
  "utf8",
);

// tsconfig.node.json 이 테스트 파일까지 컴파일해 dist 에 *.test.js 가 생기지만
// 번들 런타임엔 쓸모없고 vitest 를 긁어들이는 원인이 되므로 staging 복사 시 제외한다.
function isTestArtifact(src) {
  return src.endsWith(".test.js") || src.endsWith(".test.js.map");
}

function copyDistSubdir(name) {
  cpSync(
    path.join(projectRoot, "dist", name),
    path.join(stagingDir, "dist", name),
    {
      recursive: true,
      force: true,
      filter: (src) => !isTestArtifact(src),
    },
  );
}

copyDistSubdir("main");
copyDistSubdir("preload");
copyDistSubdir("renderer");
copyDistSubdir("shared");

// node-pty 네이티브 바이너리를 Electron 헤더 기준으로 재컴파일한다.
// npm 배포 prebuild 는 일반 Node.js 용이라, Electron 의 수정된 V8/GC 와
// 미묘한 ABI 불일치가 생겨 런타임에 V8 CHECK 실패(SIGTRAP)를 일으킬 수 잇다.
console.log("Rebuilding node-pty for Electron…");
execSync(
  `npx --yes @electron/rebuild --only node-pty --module-dir "${projectRoot}"`,
  { stdio: "inherit", cwd: projectRoot },
);

// zod 는 main 프로세스(assistant-event-queue-bridge)가 런타임에 require 하므로
// node-pty 와 마찬가지로 staging 에 복사해야 한다.
cpSync(
  path.join(projectRoot, "node_modules", "zod"),
  path.join(stagingDir, "node_modules", "zod"),
  { recursive: true, force: true, dereference: true },
);

// node-pty 는 pnpm 심볼릭 링크 너머 .pnpm/node-pty@x.x.x/node_modules/node-pty/ 에 실존하므로
// dereference 로 링크를 따라가 실제 파일을 staging 안에 복사한다.
// prebuilds/ 는 win32·linux 까지 모든 플랫폼 바이너리가 들어잇어 macOS 번들에선 ~58MB 낭비 →
// darwin-* 만 남기도록 필터링한다.
// rebuild 이후에는 build/Release/ 에 Electron 전용 .node 가 생기므로 함께 복사된다.
cpSync(
  path.join(projectRoot, "node_modules", "node-pty"),
  path.join(stagingDir, "node_modules", "node-pty"),
  {
    recursive: true,
    force: true,
    dereference: true,
    filter: (src) => {
      const prebuildsMatch = src.match(/\/prebuilds\/([^/]+)/);
      if (prebuildsMatch && !prebuildsMatch[1].startsWith("darwin-")) {
        return false;
      }
      return true;
    },
  },
);

// asar 패킹.
// prebuilds/ 안의 .node 바이너리는 dlopen, spawn-helper 는 child_process spawn 대상이라
// asar 내부에서 접근 불가 → unpackDir 로 실제 파일 시스템에 풀어둔다.
// (Electron 이 app.asar.unpacked/ 경로로 자동 리다이렉트)
await asar.createPackageWithOptions(stagingDir, asarPath, {
  unpackDir: "**/node-pty/{prebuilds,build}",
});

// staging 은 asar 에 담겻으니 정리
rmSync(stagingDir, { recursive: true, force: true });

// bin/ 스크립트들은 Claude CLI hook·MCP 설정을 통해 외부 프로세스에서 execve 로 직접 실행되므로
// asar 밖 실제 파일 경로에 놓아야 한다. Contents/Resources/bin/ 에 그대로 배치.
cpSync(
  path.join(projectRoot, "bin"),
  path.join(resourcesPath, "bin"),
  {
    recursive: true,
    force: true,
  },
);

console.log(`Packaged unsigned macOS app at ${bundlePath}`);
