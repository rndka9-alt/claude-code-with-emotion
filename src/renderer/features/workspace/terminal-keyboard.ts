export interface TerminalShortcutKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  type?: string;
}

export type SessionNavigationDirection = 'previous' | 'next';

export function shouldCreateSessionShortcut(
  event: TerminalShortcutKeyEvent,
): boolean {
  return (
    (event.type === undefined || event.type === 'keydown') &&
    event.repeat !== true &&
    event.key.toLowerCase() === 't' &&
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
    event.key.toLowerCase() === 'w' && event.metaKey && !event.ctrlKey;

  return (
    (event.type === undefined || event.type === 'keydown') &&
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
    (event.type !== undefined && event.type !== 'keydown') ||
    event.repeat === true ||
    !isCommandArrow
  ) {
    return null;
  }

  if (event.key === 'ArrowLeft') {
    return 'previous';
  }

  if (event.key === 'ArrowRight') {
    return 'next';
  }

  return null;
}
