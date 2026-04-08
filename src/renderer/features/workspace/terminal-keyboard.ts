export const MULTILINE_TERMINAL_INPUT = "\x0a";

export interface TerminalShortcutKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  type?: string;
}

export type SessionNavigationDirection = "previous" | "next";

export function isMultilineKey(event: TerminalShortcutKeyEvent): boolean {
  return (
    event.key === "Enter" &&
    (event.shiftKey || event.altKey) &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

export function shouldSendMultilineData(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    isMultilineKey(event) &&
    (event.type === undefined || event.type === "keydown") &&
    event.repeat !== true
  );
}

export function handleTerminalShortcut(
  event: TerminalShortcutKeyEvent,
  sendData: (data: string) => void,
): boolean {
  if (!isMultilineKey(event)) {
    return true;
  }

  // keydown(비-repeat)에서만 데이터 전송, keypress·keyup은 전파만 차단
  if (
    (event.type === undefined || event.type === "keydown") &&
    event.repeat !== true
  ) {
    sendData(MULTILINE_TERMINAL_INPUT);
  }

  return false;
}

export function shouldCreateSessionShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    (event.type === undefined || event.type === "keydown") &&
    event.repeat !== true &&
    event.key.toLowerCase() === "t" &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function shouldUseCloseSessionShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  const isCommandW =
    event.key.toLowerCase() === "w" && event.metaKey && !event.ctrlKey;

  return (
    (event.type === undefined || event.type === "keydown") &&
    event.repeat !== true &&
    isCommandW &&
    !event.altKey
  );
}

export function getSessionNavigationDirection(
  event: TerminalShortcutKeyEvent,
): SessionNavigationDirection | null {
  const isCommandArrow =
    event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;

  if (
    (event.type !== undefined && event.type !== "keydown") ||
    event.repeat === true ||
    !isCommandArrow
  ) {
    return null;
  }

  if (event.key === "ArrowLeft") {
    return "previous";
  }

  if (event.key === "ArrowRight") {
    return "next";
  }

  return null;
}
