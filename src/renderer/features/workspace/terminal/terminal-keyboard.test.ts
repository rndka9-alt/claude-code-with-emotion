import {
  MULTILINE_TERMINAL_INPUT,
  getPaneNavigationDirection,
  getSplitPaneDirection,
  getTabNavigationDirection,
  handleTerminalShortcut,
  isMultilineKey,
  shouldCreateTabShortcut,
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

  it("treats cmd+t as a create-tab shortcut", () => {
    expect(
      shouldCreateTabShortcut({
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

  it("does not treat ctrl+t as a create-tab shortcut", () => {
    expect(
      shouldCreateTabShortcut({
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

  it("does not treat cmd+t as a create-tab shortcut while composing", () => {
    expect(
      shouldCreateTabShortcut({
        altKey: false,
        ctrlKey: false,
        isComposing: true,
        key: "t",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe(false);
  });

  it("recognises cmd+d as a horizontal split shortcut", () => {
    expect(
      getSplitPaneDirection({
        altKey: false,
        ctrlKey: false,
        key: "d",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe("horizontal");
  });

  it("recognises cmd+shift+d as a vertical split shortcut", () => {
    expect(
      getSplitPaneDirection({
        altKey: false,
        ctrlKey: false,
        key: "d",
        metaKey: true,
        repeat: false,
        shiftKey: true,
        type: "keydown",
      }),
    ).toBe("vertical");
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

  it("treats cmd+left as a previous-tab shortcut", () => {
    expect(
      getTabNavigationDirection({
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

  it("does not treat cmd+left as a tab navigation shortcut while composing", () => {
    expect(
      getTabNavigationDirection({
        altKey: false,
        ctrlKey: false,
        isComposing: true,
        key: "ArrowLeft",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBeNull();
  });

  it("treats cmd+option+right as a pane navigation shortcut", () => {
    expect(
      getPaneNavigationDirection({
        altKey: true,
        ctrlKey: false,
        key: "ArrowRight",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBe("right");
  });

  it("does not treat ctrl+right as a tab navigation shortcut", () => {
    expect(
      getTabNavigationDirection({
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

  it("does not treat cmd+shift+left as a pane navigation shortcut", () => {
    expect(
      getPaneNavigationDirection({
        altKey: true,
        ctrlKey: false,
        key: "ArrowLeft",
        metaKey: true,
        repeat: false,
        shiftKey: true,
        type: "keydown",
      }),
    ).toBeNull();
  });

  it("does not treat cmd+option+right as a pane navigation shortcut while composing", () => {
    expect(
      getPaneNavigationDirection({
        altKey: true,
        ctrlKey: false,
        isComposing: true,
        key: "ArrowRight",
        metaKey: true,
        repeat: false,
        shiftKey: false,
        type: "keydown",
      }),
    ).toBeNull();
  });
});
