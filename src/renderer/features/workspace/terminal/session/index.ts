export type {
  TerminalMirrorController,
  TerminalSessionController,
} from "./terminal-session-controller";
export {
  applyTerminalSessionSearch,
  clearTerminalSessionSearch,
  disposeAllTerminalSessions,
  disposeTerminalSession,
  disposeTerminalSessionsExcept,
  getTerminalSessionController,
  syncAllTerminalThemes,
  updateTerminalSessionSearchResultsHandler,
} from "./terminal-session-registry";
