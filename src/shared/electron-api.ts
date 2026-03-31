export interface ClaudeAppApi {
  readonly appVersion: string;
}

declare global {
  interface Window {
    claudeApp?: ClaudeAppApi;
  }
}

export {};
