export { TerminalLayout } from "./TerminalLayout";
export { TerminalSurface } from "./TerminalSurface";
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
  disposeAllTerminalSessions,
  disposeTerminalSession,
  disposeTerminalSessionsExcept,
  getTerminalSessionController,
  handleTerminalExternalBrowserClick,
  syncAllTerminalThemes,
} from "./terminal-session-registry";
export {
  useTerminalSessionPruner,
  useWorkspaceTerminalExitSubscription,
} from "./_hooks";
