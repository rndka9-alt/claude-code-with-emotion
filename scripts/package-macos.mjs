import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_NAME = "Claude Code With Emotion";
const APP_IDENTIFIER = "com.igangmin.claude-code-with-emotion";

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

function copyRuntimeTree(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    force: true,
  });
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
const resourcesAppPath = path.join(bundlePath, "Contents", "Resources", "app");
const executableDir = path.join(bundlePath, "Contents", "MacOS");
const infoPlistPath = path.join(bundlePath, "Contents", "Info.plist");

if (!existsSync(electronAppTemplatePath)) {
  throw new Error(
    'Electron.app template was not found. Run "pnpm install" before packaging.',
  );
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyRuntimeTree(electronAppTemplatePath, bundlePath);

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

mkdirSync(resourcesAppPath, { recursive: true });

const runtimePackageJson = {
  name: "claude-code-with-emotion",
  version: "0.1.0",
  main: "dist/main/index.js",
  productName: APP_NAME,
};

writeFileSync(
  path.join(resourcesAppPath, "package.json"),
  `${JSON.stringify(runtimePackageJson, null, 2)}\n`,
  "utf8",
);

copyRuntimeTree(
  path.join(projectRoot, "dist", "main"),
  path.join(resourcesAppPath, "dist", "main"),
);
copyRuntimeTree(
  path.join(projectRoot, "dist", "preload"),
  path.join(resourcesAppPath, "dist", "preload"),
);
copyRuntimeTree(
  path.join(projectRoot, "dist", "renderer"),
  path.join(resourcesAppPath, "dist", "renderer"),
);
copyRuntimeTree(
  path.join(projectRoot, "node_modules"),
  path.join(resourcesAppPath, "node_modules"),
);
copyRuntimeTree(
  path.join(projectRoot, "bin"),
  path.join(resourcesAppPath, "bin"),
);

console.log(`Packaged unsigned macOS app at ${bundlePath}`);
