import type { AssistantStatusBridge } from './assistant-status';
import type { RuntimeDiagnosticPayload } from './diagnostics';
import type { TerminalBridge } from './terminal-bridge';

export interface DiagnosticsBridge {
  onRuntimeEvent: (
    listener: (payload: RuntimeDiagnosticPayload) => void,
  ) => () => void;
}

export interface ClaudeAppApi {
  readonly appVersion: string;
  readonly assistantStatus: AssistantStatusBridge;
  readonly diagnostics: DiagnosticsBridge;
  readonly terminals: TerminalBridge;
}

declare global {
  interface Window {
    claudeApp?: ClaudeAppApi;
  }
}

export {};
