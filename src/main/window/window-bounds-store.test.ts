import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WindowBoundsStore } from "./window-bounds-store";

describe("WindowBoundsStore", () => {
  it("starts empty when no saved bounds file exists", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "window-bounds-store-empty-"),
    );
    const store = new WindowBoundsStore(
      path.join(directoryPath, "window-bounds.json"),
    );

    expect(store.getBounds()).toBeNull();
  });

  it("persists and reloads both window size and position", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "window-bounds-store-save-"),
    );
    const filePath = path.join(directoryPath, "window-bounds.json");
    const firstStore = new WindowBoundsStore(filePath);

    firstStore.save({
      x: 144,
      y: 96,
      width: 1280,
      height: 860,
    });

    const secondStore = new WindowBoundsStore(filePath);

    expect(secondStore.getBounds()).toEqual({
      x: 144,
      y: 96,
      width: 1280,
      height: 860,
    });
  });

  it("ignores invalid saved bounds shapes", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "window-bounds-store-invalid-"),
    );
    const filePath = path.join(directoryPath, "window-bounds.json");

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        width: 1280,
        height: 860,
      }),
      "utf8",
    );

    const store = new WindowBoundsStore(filePath);

    expect(store.getBounds()).toBeNull();
  });
});
