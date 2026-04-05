import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  joinPathList,
  resolveHomeDir,
  splitPathList,
} from "./platform-paths";

describe("splitPathList", () => {
  it("splits on path.delimiter and ignores empty or undefined inputs", () => {
    const combined = ["/a", "/b", "/c"].join(path.delimiter);

    expect(splitPathList(combined)).toEqual(["/a", "/b", "/c"]);
    expect(splitPathList("")).toEqual([]);
    expect(splitPathList(undefined)).toEqual([]);
    expect(splitPathList(null)).toEqual([]);
  });
});

describe("joinPathList", () => {
  it("joins segments with path.delimiter", () => {
    expect(joinPathList(["/a", "/b"])).toBe(`/a${path.delimiter}/b`);
    expect(joinPathList([])).toBe("");
  });
});

describe("resolveHomeDir", () => {
  it("prefers HOME when set", () => {
    expect(resolveHomeDir({ HOME: "/home/zzu", USERPROFILE: "C:\\zzu" })).toBe(
      "/home/zzu",
    );
  });

  it("falls back to USERPROFILE when HOME is missing", () => {
    expect(resolveHomeDir({ USERPROFILE: "C:\\Users\\zzu" })).toBe(
      "C:\\Users\\zzu",
    );
  });

  it("falls back to HOMEDRIVE+HOMEPATH when neither HOME nor USERPROFILE is set", () => {
    expect(
      resolveHomeDir({ HOMEDRIVE: "C:", HOMEPATH: "\\Users\\zzu" }),
    ).toBe("C:\\Users\\zzu");
  });

  it("returns undefined when no home-like variable is present", () => {
    expect(resolveHomeDir({})).toBeUndefined();
    expect(resolveHomeDir({ HOME: "" })).toBeUndefined();
  });
});
