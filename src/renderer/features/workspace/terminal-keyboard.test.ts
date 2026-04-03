import {
  getSessionNavigationDirection,
  shouldCreateSessionShortcut,
  shouldUseCloseSessionShortcut,
} from './terminal-keyboard';

describe('terminal keyboard shortcuts', () => {
  it('treats cmd+t as a create-session shortcut', () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: 't',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(true);
  });

  it('does not treat ctrl+t as a create-session shortcut', () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: true,
        key: 't',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('does not treat cmd+shift+t as a create-session shortcut', () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: 't',
        metaKey: true,
        repeat: false,
        shiftKey: true,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('detects cmd+w as a session close shortcut', () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: 'w',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(true);
  });

  it('does not detect ctrl+w as a session close shortcut', () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: false,
        ctrlKey: true,
        key: 'w',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('does not treat alt+cmd+w as a session close shortcut', () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: true,
        ctrlKey: false,
        key: 'w',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('treats cmd+left as a previous-session shortcut', () => {
    expect(
      getSessionNavigationDirection({
        altKey: false,
        ctrlKey: false,
        key: 'ArrowLeft',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe('previous');
  });

  it('does not treat ctrl+right as a next-session shortcut', () => {
    expect(
      getSessionNavigationDirection({
        altKey: false,
        ctrlKey: true,
        key: 'ArrowRight',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBeNull();
  });

  it('does not treat alt+cmd+left as a session shortcut', () => {
    expect(
      getSessionNavigationDirection({
        altKey: true,
        ctrlKey: false,
        key: 'ArrowLeft',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBeNull();
  });
});
