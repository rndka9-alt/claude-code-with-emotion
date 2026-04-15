export type TerminalSearchDirection = "next" | "previous";

export interface TerminalSearchRequest {
  direction: TerminalSearchDirection;
  query: string;
  sequence: number;
  sessionId: string;
}

export interface TerminalSearchResults {
  resultCount: number;
  resultIndex: number;
  sessionId: string;
}
