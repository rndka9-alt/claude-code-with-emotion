import type {
  PaneFocusDirection,
  PaneSplitDirection,
} from "../model";

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

export type TabNavigationDirection = "previous" | "next";

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

  if (
    (event.type === undefined || event.type === "keydown") &&
    event.repeat !== true
  ) {
    sendData(MULTILINE_TERMINAL_INPUT);
  }

  return false;
}

export function shouldCreateTabShortcut(
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

export function getSplitPaneDirection(
  event: TerminalShortcutKeyEvent,
): PaneSplitDirection | null {
  const isCommandD =
    event.key.toLowerCase() === "d" &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey;

  if (
    (event.type !== undefined && event.type !== "keydown") ||
    event.repeat === true ||
    !isCommandD
  ) {
    return null;
  }

  return event.shiftKey ? "vertical" : "horizontal";
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

export function getTabNavigationDirection(
  event: TerminalShortcutKeyEvent,
): TabNavigationDirection | null {
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

export function getPaneNavigationDirection(
  event: TerminalShortcutKeyEvent,
): PaneFocusDirection | null {
  const isCommandOptionArrow =
    event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey;

  if (
    (event.type !== undefined && event.type !== "keydown") ||
    event.repeat === true ||
    !isCommandOptionArrow
  ) {
    return null;
  }

  if (event.key === "ArrowLeft") {
    return "left";
  }

  if (event.key === "ArrowRight") {
    return "right";
  }

  if (event.key === "ArrowUp") {
    return "up";
  }

  if (event.key === "ArrowDown") {
    return "down";
  }

  return null;
}
