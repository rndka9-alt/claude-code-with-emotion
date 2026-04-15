export type TerminalSearchDirection = "next" | "previous";
export type TerminalSearchMode = "navigate" | "preview";

export interface TerminalSearchRequest {
  anchorIndex: number | null;
  direction: TerminalSearchDirection;
  mode: TerminalSearchMode;
  query: string;
  sequence: number;
  sessionId: string;
}

export interface TerminalSearchResults {
  hasMatch: boolean;
  resultCount: number | null;
  resultIndex: number | null;
  sessionId: string;
}
