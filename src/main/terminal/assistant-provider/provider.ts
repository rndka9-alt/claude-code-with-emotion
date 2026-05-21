import type { AssistantProviderMetadata } from "../../../shared/assistant-provider";
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

export interface AssistantProvider extends AssistantProviderMetadata {
  createSessionEnvironment: (
    options: AssistantProviderSessionEnvironmentOptions,
  ) => Record<string, string>;
  mcpSetup: AssistantProviderMcpSetup;
}
