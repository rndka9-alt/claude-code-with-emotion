import {
  handleTerminalShortcut,
  MULTILINE_TERMINAL_INPUT,
  shouldUseMultilineShortcut,
} from './terminal-keyboard';

describe('terminal keyboard shortcuts', () => {
  it('treats shift+enter as multiline input', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: 'keydown',
      }),
    ).toBe(true);
  });

  it('treats option+enter as multiline input', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: true,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(true);
  });

  it('keeps plain enter on the default terminal path', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('does not hijack meta-modified enter', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('ignores repeated multiline enter events', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: true,
        shiftKey: true,
        type: 'keydown',
      }),
    ).toBe(false);
  });

  it('ignores non-keydown multiline enter events', () => {
    expect(
      shouldUseMultilineShortcut({
        altKey: true,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: 'keyup',
      }),
    ).toBe(false);
  });

  it('sends ctrl+j semantics when a multiline shortcut is intercepted', () => {
    const sentData: string[] = [];

    const didAllowDefaultHandling = handleTerminalShortcut(
      {
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: 'keydown',
      },
      (data) => {
        sentData.push(data);
      },
    );

    expect(didAllowDefaultHandling).toBe(false);
    expect(sentData).toEqual([MULTILINE_TERMINAL_INPUT]);
  });
});
