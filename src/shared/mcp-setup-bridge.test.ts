import { parseVisualMcpSetupRequest } from "./mcp-setup-bridge";

describe("Visual MCP setup bridge", () => {
  it("keeps an omitted setup target on the default path", () => {
    expect(parseVisualMcpSetupRequest(undefined)).toEqual({});
    expect(parseVisualMcpSetupRequest({})).toEqual({});
  });

  it("parses supported setup targets", () => {
    expect(parseVisualMcpSetupRequest({ targetId: "claude" })).toEqual({
      targetId: "claude",
    });
    expect(parseVisualMcpSetupRequest({ targetId: "codex" })).toEqual({
      targetId: "codex",
    });
  });

  it("rejects unsupported setup targets", () => {
    expect(() => {
      parseVisualMcpSetupRequest({ targetId: "unknown" });
    }).toThrow("Visual MCP setup target must be claude or codex.");
  });
});
