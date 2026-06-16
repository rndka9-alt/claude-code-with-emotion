import { describe, expect, it } from "vitest";
import { TerminalEmulatorState } from "./terminal-emulator-state";

describe("TerminalEmulatorState", () => {
  it("serializes alternate screen state for renderer rehydration", async () => {
    const emulatorState = new TerminalEmulatorState(20, 5);

    try {
      emulatorState.write("normal\r\n");
      emulatorState.write("\x1b[?1049hAlt screen");

      const snapshot = await emulatorState.getSnapshot();

      expect(snapshot).toContain("\x1b[?1049h");
      expect(snapshot).toContain("Alt screen");
    } finally {
      emulatorState.dispose();
    }
  });
});
