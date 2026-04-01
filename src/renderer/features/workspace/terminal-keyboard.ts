export const MULTILINE_TERMINAL_INPUT = '\x0a';

export interface TerminalShortcutKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

export function shouldUseMultilineShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    event.key === 'Enter' &&
    (event.shiftKey || event.altKey) &&
    !event.ctrlKey &&
    !event.metaKey
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
