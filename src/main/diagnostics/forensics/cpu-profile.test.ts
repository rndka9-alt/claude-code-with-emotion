import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractCpuProfile, isRecord, writeCpuProfile } from "./cpu-profile";

describe("isRecord", () => {
  it("accepts plain objects and rejects null/primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("extractCpuProfile", () => {
  it("returns the profile when it carries a nodes array", () => {
    const profile = { nodes: [], startTime: 0, endTime: 1 };

    expect(extractCpuProfile({ profile })).toBe(profile);
  });

  it("returns null when the result is not a CDP profile envelope", () => {
    expect(extractCpuProfile(null)).toBeNull();
    expect(extractCpuProfile({})).toBeNull();
    expect(extractCpuProfile({ profile: {} })).toBeNull();
    expect(extractCpuProfile({ profile: { nodes: "nope" } })).toBeNull();
  });
});

describe("writeCpuProfile", () => {
  it("saves a .cpuprofile and encodes timing into the file name", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "forensics-test-"));
    const profile = { nodes: [], startTime: 0, endTime: 1 };

    const filePath = writeCpuProfile(directory, "renderer-stall", profile, {
      detectedAt: "2026-06-25T06:30:00.000Z",
      durationMs: 2150.7,
    });

    expect(filePath).toBe(
      path.join(
        directory,
        "renderer-stall-2026-06-25T06-30-00-000Z-2151ms.cpuprofile",
      ),
    );
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual(profile);
  });
});
