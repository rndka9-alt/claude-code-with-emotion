import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TERMINAL_HISTORY_LINES } from "../../shared/terminal-history";

export interface TerminalOutputSnapshot {
  output: string;
  version: number;
}

const OUTPUT_FLUSH_DELAY_MS = 30;

export class TerminalOutputStore {
  private completedLines: string[] = [];
  private pendingOutput = "";
  private version = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly filePath: string,
    private readonly maxOutputLines: number = DEFAULT_TERMINAL_HISTORY_LINES,
  ) {}

  reset(): void {
    this.completedLines = [];
    this.pendingOutput = "";
    this.version = 0;
    this.flushSync();
  }

  append(data: string): number {
    if (data.length === 0) {
      return this.version;
    }

    const nextOutput = `${this.pendingOutput}${data}`;
    let nextLineStartIndex = 0;
    let newlineIndex = nextOutput.indexOf("\n");

    while (newlineIndex !== -1) {
      this.completedLines.push(
        nextOutput.slice(nextLineStartIndex, newlineIndex + 1),
      );
      nextLineStartIndex = newlineIndex + 1;
      newlineIndex = nextOutput.indexOf("\n", nextLineStartIndex);
    }

    this.pendingOutput = nextOutput.slice(nextLineStartIndex);

    if (
      this.maxOutputLines >= 0 &&
      this.completedLines.length > this.maxOutputLines
    ) {
      this.completedLines.splice(
        0,
        this.completedLines.length - this.maxOutputLines,
      );
    }

    this.version += 1;
    this.scheduleFlush();

    return this.version;
  }

  getSnapshot(): TerminalOutputSnapshot {
    return {
      output: `${this.completedLines.join("")}${this.pendingOutput}`,
      version: this.version,
    };
  }

  dispose(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushSync();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushSync();
    }, OUTPUT_FLUSH_DELAY_MS);
  }

  private flushSync(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, this.getSnapshot().output, "utf8");
  }
}
