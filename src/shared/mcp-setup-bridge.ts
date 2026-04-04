export interface VisualMcpSetupStatus {
  installed: boolean;
  stateFilePath: string;
}

export interface VisualMcpSetupBridge {
  getStatus: () => Promise<VisualMcpSetupStatus>;
  install: () => Promise<VisualMcpSetupStatus>;
  remove: () => Promise<VisualMcpSetupStatus>;
}

export const MCP_SETUP_CHANNELS = {
  getStatus: "mcp-setup:get-status",
  install: "mcp-setup:install",
  remove: "mcp-setup:remove",
} as const;
