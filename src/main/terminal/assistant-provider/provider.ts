import type { VisualMcpSetupStatus } from "../../../shared/mcp-setup-bridge";

export interface AssistantProviderSessionEnvironmentOptions {
  cwd: string;
  eventQueueDir: string;
  helperBinDir: string;
  traceFilePath: string;
  userDataPath: string;
  visualAssetCatalogFilePath: string;
}

export interface AssistantProviderMcpSetup {
  getStatus: (stateFilePath: string) => VisualMcpSetupStatus;
  install: (
    helperBinDir: string,
    stateFilePath: string,
  ) => VisualMcpSetupStatus;
  remove: (stateFilePath: string) => VisualMcpSetupStatus;
}

export interface AssistantProvider {
  displayName: string;
  id: string;
  launchCommand: string;
  createSessionEnvironment: (
    options: AssistantProviderSessionEnvironmentOptions,
  ) => Record<string, string>;
  mcpSetup: AssistantProviderMcpSetup;
}
