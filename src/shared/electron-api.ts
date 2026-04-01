import type { AssistantStatusBridge } from './assistant-status';
import type { TerminalBridge } from './terminal-bridge';

export interface ClaudeAppApi {
  readonly appVersion: string;
  readonly assistantStatus: AssistantStatusBridge;
  readonly terminals: TerminalBridge;
}

declare global {
  interface Window {
    claudeApp?: ClaudeAppApi;
  }
}

export {};
