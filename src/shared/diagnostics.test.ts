import { RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX } from "./diagnostics";

describe("RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX", () => {
  it("matches the renderer runtime log prefix format", () => {
    expect(
      `${RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX}assistant-status-file] parsed update`,
    ).toBe("[runtime:assistant-status-file] parsed update");
  });
});
