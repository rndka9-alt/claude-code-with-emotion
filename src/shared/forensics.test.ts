import { isForensicsFlagEnabled } from "./forensics";

describe("isForensicsFlagEnabled", () => {
  it("enables on \"1\" or \"true\"", () => {
    expect(isForensicsFlagEnabled("1")).toBe(true);
    expect(isForensicsFlagEnabled("true")).toBe(true);
  });

  it("stays disabled for missing or other values", () => {
    expect(isForensicsFlagEnabled(undefined)).toBe(false);
    expect(isForensicsFlagEnabled("0")).toBe(false);
    expect(isForensicsFlagEnabled("")).toBe(false);
    expect(isForensicsFlagEnabled("yes")).toBe(false);
  });
});
