export interface WorkspaceCommandBridge {
  onOpenTerminalSearch: (listener: () => void) => () => void;
}

export const WORKSPACE_COMMAND_CHANNELS: {
  openTerminalSearch: string;
} = {
  openTerminalSearch: "workspace-command:open-terminal-search",
};
