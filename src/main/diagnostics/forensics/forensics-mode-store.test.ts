import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ForensicsModeStore } from "./forensics-mode-store";

describe("ForensicsModeStore", () => {
  it("defaults to disabled when no file exists yet", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "forensics-mode-"));
    const store = new ForensicsModeStore(
      path.join(directory, "forensics.json"),
    );

    expect(store.isEnabled()).toBe(false);
  });

  it("persists the enabled flag to disk and reloads it", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "forensics-mode-"));
    const filePath = path.join(directory, "forensics.json");
    const store = new ForensicsModeStore(filePath);

    store.setEnabled(true);

    expect(store.isEnabled()).toBe(true);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({
      enabled: true,
    });

    const reloaded = new ForensicsModeStore(filePath);

    expect(reloaded.isEnabled()).toBe(true);
  });

  it("falls back to disabled when the stored shape is invalid", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "forensics-mode-"));
    const filePath = path.join(directory, "forensics.json");
    writeFileSync(filePath, JSON.stringify({ enabled: "yes" }), "utf8");

    const store = new ForensicsModeStore(filePath);

    expect(store.isEnabled()).toBe(false);
  });
});
