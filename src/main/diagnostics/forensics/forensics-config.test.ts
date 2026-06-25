import {
  isForensicsEnabled,
  resolveForensicsDirectory,
} from "./forensics-config";

describe("isForensicsEnabled", () => {
  it("reads the FORENSICS flag from the provided env", () => {
    expect(isForensicsEnabled({ FORENSICS: "1" })).toBe(true);
    expect(isForensicsEnabled({ FORENSICS: "true" })).toBe(true);
  });

  it("is disabled when the flag is absent or off", () => {
    expect(isForensicsEnabled({})).toBe(false);
    expect(isForensicsEnabled({ FORENSICS: "0" })).toBe(false);
  });
});

describe("resolveForensicsDirectory", () => {
  it("uses a workspace path in development", () => {
    expect(resolveForensicsDirectory("/tmp/app", "/tmp/user-data", false)).toBe(
      "/tmp/app/.runtime-logs/forensics",
    );
  });

  it("uses the user-data logs path in packaged mode", () => {
    expect(resolveForensicsDirectory("/tmp/app", "/tmp/user-data", true)).toBe(
      "/tmp/user-data/logs/forensics",
    );
  });
});
