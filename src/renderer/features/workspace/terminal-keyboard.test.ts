import {
  MULTILINE_TERMINAL_INPUT,
  getSessionNavigationDirection,
  handleTerminalShortcut,
  isMultilineKey,
  shouldCreateSessionShortcut,
  shouldSendMultilineData,
  shouldUseCloseSessionShortcut,
} from "./terminal-keyboard";

describe("terminal keyboard shortcuts", () => {
  it("recognises shift+enter as a multiline key", () => {
    expect(
      isMultilineKey({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe(true);
  });

  it("recognises option+enter as a multiline key", () => {
    expect(
      isMultilineKey({
        altKey: true,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
  });

  it("does not treat plain enter as a multiline key", () => {
    expect(
      isMultilineKey({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
  });

  it("does not treat cmd+enter as a multiline key", () => {
    expect(
      isMultilineKey({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: true,
        shiftKey: false,
      }),
    ).toBe(false);
  });

  it("allows sending data on keydown", () => {
    expect(
      shouldSendMultilineData({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: "keydown",
      }),
    ).toBe(true);
  });

  it("blocks data on repeated keydown", () => {
    expect(
      shouldSendMultilineData({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: true,
        shiftKey: true,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("blocks data on keypress", () => {
    expect(
      shouldSendMultilineData({
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: "keypress",
      }),
    ).toBe(false);
  });

  it("blocks data on keyup", () => {
    expect(
      shouldSendMultilineData({
        altKey: true,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: "keyup",
      }),
    ).toBe(false);
  });

  it("sends data and blocks xterm on keydown via handleTerminalShortcut", () => {
    const sentData: string[] = [];

    const result = handleTerminalShortcut(
      {
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: "keydown",
      },
      (data) => {
        sentData.push(data);
      },
    );

    expect(result).toBe(false);
    expect(sentData).toEqual([MULTILINE_TERMINAL_INPUT]);
  });

  it("blocks xterm on keypress without sending data", () => {
    const sentData: string[] = [];

    const result = handleTerminalShortcut(
      {
        altKey: false,
        ctrlKey: false,
        key: "Enter",
        metaKey: false,
        repeat: false,
        shiftKey: true,
        type: "keypress",
      },
      (data) => {
        sentData.push(data);
      },
    );

    expect(result).toBe(false);
    expect(sentData).toEqual([]);
  });


  it("treats cmd+t as a create-session shortcut", () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: "t",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(true);
  });

  it("does not treat ctrl+t as a create-session shortcut", () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: true,
        key: "t",
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("does not treat cmd+shift+t as a create-session shortcut", () => {
    expect(
      shouldCreateSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: "t",
        metaKey: true,
        repeat: false,
        shiftKey: true,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("detects cmd+w as a session close shortcut", () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: false,
        ctrlKey: false,
        key: "w",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(true);
  });

  it("does not detect ctrl+w as a session close shortcut", () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: false,
        ctrlKey: true,
        key: "w",
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("does not treat alt+cmd+w as a session close shortcut", () => {
    expect(
      shouldUseCloseSessionShortcut({
        altKey: true,
        ctrlKey: false,
        key: "w",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("treats cmd+left as a previous-session shortcut", () => {
    expect(
      getSessionNavigationDirection({
        altKey: false,
        ctrlKey: false,
        key: "ArrowLeft",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe("previous");
  });

  it("does not treat ctrl+right as a next-session shortcut", () => {
    expect(
      getSessionNavigationDirection({
        altKey: false,
        ctrlKey: true,
        key: "ArrowRight",
        metaKey: false,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBeNull();
  });

  it("does not treat alt+cmd+left as a session shortcut", () => {
    expect(
      getSessionNavigationDirection({
        altKey: true,
        ctrlKey: false,
        key: "ArrowLeft",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBeNull();
  });
});
