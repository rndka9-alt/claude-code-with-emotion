import type { Input } from "electron";
import { shouldIgnoreMenuShortcutsForReload } from "./workspace-window-reload-prevention";

function createInput(overrides: Partial<Input>): Input {
  return {
    alt: false,
    code: "",
    control: false,
    isAutoRepeat: false,
    isComposing: false,
    key: "",
    location: 0,
    meta: false,
    modifiers: [],
    shift: false,
    type: "keyDown",
    ...overrides,
  };
}

describe("shouldIgnoreMenuShortcutsForReload", () => {
  it("ignores Electron menu shortcuts for command+r on macOS", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ key: "r", meta: true }),
        "darwin",
      ),
    ).toBe(true);
  });

  it("ignores Electron menu shortcuts for command+shift+r on macOS", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ key: "R", meta: true, shift: true }),
        "darwin",
      ),
    ).toBe(true);
  });

  it("keeps macOS control+r out of Electron menu shortcut suppression", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ control: true, key: "r" }),
        "darwin",
      ),
    ).toBe(false);
  });

  it("ignores Electron menu shortcuts for control+r on non-macOS platforms", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ control: true, key: "r" }),
        "win32",
      ),
    ).toBe(true);
  });

  it("ignores Electron menu shortcuts for F5 browser reload shortcuts", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ code: "F5", key: "F5" }),
        "win32",
      ),
    ).toBe(true);
  });

  it("ignores keyup events", () => {
    expect(
      shouldIgnoreMenuShortcutsForReload(
        createInput({ key: "r", meta: true, type: "keyUp" }),
        "darwin",
      ),
    ).toBe(false);
  });
});
