import path from "node:path";

interface ResolveWorkspaceBridgePathsOptions {
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  userDataPath: string;
}

export interface WorkspaceBridgePaths {
  appThemeFilePath: string;
  assistantStatusHelperBinDir: string;
  assistantStatusTraceFilePath: string;
  terminalOutputRootDir: string;
  userDataPath: string;
  visualAssetCatalogFilePath: string;
  visualAssetLibraryDirPath: string;
  visualMcpStateFilePath: string;
}

export function resolveWorkspaceBridgePaths({
  appPath,
  isPackaged,
  resourcesPath,
  userDataPath,
}: ResolveWorkspaceBridgePathsOptions): Omit<
  WorkspaceBridgePaths,
  "assistantStatusTraceFilePath"
> {
  // 패키징된 앱에선 bin/ 이 app.asar 밖 Contents/Resources/bin/ 에 놓인다.
  // bin 스크립트들은 Claude CLI hook 이나 child_process.spawn 으로 외부에서 직접 실행되므로
  // Electron 의 asar fs 패치가 적용되지 않는 환경에서도 접근 가능한 실제 파일 경로가 필요.
  const assistantStatusHelperBinDir = isPackaged
    ? path.join(resourcesPath, "bin")
    : path.join(appPath, "bin");

  return {
    appThemeFilePath: path.join(userDataPath, "app-theme.json"),
    assistantStatusHelperBinDir,
    terminalOutputRootDir: path.join(userDataPath, "terminal-output"),
    userDataPath,
    visualAssetCatalogFilePath: path.join(userDataPath, "visual-assets.json"),
    visualAssetLibraryDirPath: path.join(userDataPath, "visual-assets"),
    visualMcpStateFilePath: path.join(userDataPath, "assistant-visual-mcp.json"),
  };
}
