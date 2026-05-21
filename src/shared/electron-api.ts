import type { AssistantProviderMetadata } from "./assistant-provider";
import type { AppThemeBridge } from "./app-theme-bridge";
import type {
  AssistantSnapshotsBySessionId,
  AssistantStatusBridge,
} from "./assistant-status";
import type { RuntimeDiagnosticPayload } from "./diagnostics";
import type { LinksBridge } from "./links-bridge";
import type { VisualMcpSetupBridge } from "./mcp-setup-bridge";
import type { TerminalBridge } from "./terminal-bridge";
import type { VisualAssetBridge } from "./visual-assets-bridge";
import type { WorkspaceCommandBridge } from "./workspace-command-bridge";
import type { WorkspaceState } from "./workspace-state";
import type { WorkspaceWindowBridge } from "./workspace-window-bridge";

export interface DiagnosticsBridge {
  onRuntimeEvent: (
    listener: (payload: RuntimeDiagnosticPayload) => void,
  ) => () => void;
}

export interface ClaudeAppApi {
  readonly appVersion: string;
  readonly assistantProvider: AssistantProviderMetadata;
  readonly initialAssistantSnapshotsBySessionId?: AssistantSnapshotsBySessionId;
  readonly initialWorkspaceState?: WorkspaceState;
  readonly workspaceCwd: string;
  readonly appTheme: AppThemeBridge;
  readonly assistantStatus: AssistantStatusBridge;
  readonly diagnostics: DiagnosticsBridge;
  readonly links: LinksBridge;
  readonly mcpSetup: VisualMcpSetupBridge;
  readonly terminals: TerminalBridge;
  readonly visualAssets: VisualAssetBridge;
  readonly workspaceCommands: WorkspaceCommandBridge;
  readonly workspaceWindows: WorkspaceWindowBridge;
}

declare global {
  interface Window {
    claudeApp?: ClaudeAppApi;
  }
}

export {};
