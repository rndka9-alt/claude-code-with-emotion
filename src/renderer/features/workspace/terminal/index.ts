export { TerminalLayout } from "./TerminalLayout";
export { TerminalSurface } from "./TerminalSurface";
export {
  disposeAllTerminalSessions,
  disposeTerminalSession,
  disposeTerminalSessionsExcept,
  getTerminalSessionController,
  syncAllTerminalThemes,
} from "./session";
export { handleTerminalExternalBrowserClick } from "./terminal-dom";
export {
  getPaneNavigationDirection,
  getSplitPaneDirection,
  getTabNavigationDirection,
  handleTerminalShortcut,
  isMultilineKey,
  MULTILINE_TERMINAL_INPUT,
  shouldCreateTabShortcut,
  shouldSendMultilineData,
  shouldUseCloseSessionShortcut,
} from "./terminal-keyboard";
export {
  useTerminalSessionPruner,
  useWorkspaceTerminalExitSubscription,
} from "./_hooks";
