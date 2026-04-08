import { describe, it, expect } from "vitest";
import { stripScreenHardstatus } from "./strip-screen-hardstatus";

describe("stripScreenHardstatus", () => {
  it("일반 텍스트는 그대로 통과한다", () => {
    expect(stripScreenHardstatus("hello world")).toBe("hello world");
  });

  it("ANSI 색상 시퀀스는 그대로 통과한다", () => {
    const colored = "\x1b[31mred\x1b[0m";
    expect(stripScreenHardstatus(colored)).toBe(colored);
  });

  it("OSC 타이틀 시퀀스는 그대로 통과한다", () => {
    const osc = "\x1b]0;my title\x07";
    expect(stripScreenHardstatus(osc)).toBe(osc);
  });

  it("screen 하드스테이터스 시퀀스를 제거한다", () => {
    expect(stripScreenHardstatus("\x1bkcd\x1b\\")).toBe("");
  });

  it("시퀀스 앞뒤의 텍스트는 보존한다", () => {
    expect(stripScreenHardstatus("before\x1bkgrep\x1b\\after")).toBe(
      "beforeafter",
    );
  });

  it("한 chunk에 시퀀스가 여러 번 오면 전부 제거한다", () => {
    const input = "\x1bkcd\x1b\\output\x1bkvim\x1b\\more";
    expect(stripScreenHardstatus(input)).toBe("outputmore");
  });

  it("시퀀스 내용이 빈 문자열이어도 제거한다", () => {
    expect(stripScreenHardstatus("\x1bk\x1b\\")).toBe("");
  });

  it("시퀀스 내용에 특수문자가 포함되어도 제거한다", () => {
    expect(
      stripScreenHardstatus("\x1bk~/workspace/project\x1b\\"),
    ).toBe("");
  });
});
