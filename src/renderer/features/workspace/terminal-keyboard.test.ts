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
        shiftKey: true,
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
        shiftKey: false,
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
        shiftKey: false,
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
        shiftKey: false,
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
        shiftKey: true,
      },
      (data) => {
        sentData.push(data);
      },
    );

    expect(didAllowDefaultHandling).toBe(false);
    expect(sentData).toEqual([MULTILINE_TERMINAL_INPUT]);
  });
});
