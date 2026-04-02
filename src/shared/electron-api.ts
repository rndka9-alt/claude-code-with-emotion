import type { AppThemeBridge } from './app-theme-bridge';
import type { AssistantStatusBridge } from './assistant-status';
import type { RuntimeDiagnosticPayload } from './diagnostics';
import type { TerminalBridge } from './terminal-bridge';
import type { VisualAssetBridge } from './visual-assets-bridge';

export interface DiagnosticsBridge {
  onRuntimeEvent: (
    listener: (payload: RuntimeDiagnosticPayload) => void,
  ) => () => void;
}

export interface ClaudeAppApi {
  readonly appVersion: string;
  readonly workspaceCwd: string;
  readonly appTheme: AppThemeBridge;
  readonly assistantStatus: AssistantStatusBridge;
  readonly diagnostics: DiagnosticsBridge;
  readonly terminals: TerminalBridge;
  readonly visualAssets: VisualAssetBridge;
}

declare global {
  interface Window {
    claudeApp?: ClaudeAppApi;
  }
}

export {};
