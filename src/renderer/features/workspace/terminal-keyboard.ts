export const MULTILINE_TERMINAL_INPUT = '\x0a';

export interface TerminalShortcutKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  type?: string;
}

export function shouldUseMultilineShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    (event.type === undefined || event.type === 'keydown') &&
    event.repeat !== true &&
    event.key === 'Enter' &&
    (event.shiftKey || event.altKey) &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

export function shouldCreateSessionShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    (event.type === undefined || event.type === 'keydown') &&
    event.repeat !== true &&
    event.key.toLowerCase() === 't' &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey)) &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function shouldUseCloseSessionShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  const isCommandOrControlW =
    event.key.toLowerCase() === 'w' && (event.metaKey || event.ctrlKey);

  return (
    (event.type === undefined || event.type === 'keydown') &&
    event.repeat !== true &&
    isCommandOrControlW &&
    !event.altKey
  );
}

export function handleTerminalShortcut(
  event: TerminalShortcutKeyEvent,
  sendData: (data: string) => void,
): boolean {
  if (!shouldUseMultilineShortcut(event)) {
    return true;
  }

  sendData(MULTILINE_TERMINAL_INPUT);
  return false;
}
