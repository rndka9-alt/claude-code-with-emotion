import fs from 'node:fs';
import path from 'node:path';

export interface TerminalOutputSnapshot {
  output: string;
  version: number;
}

const DEFAULT_MAX_OUTPUT_CHARS = 200_000;
const OUTPUT_FLUSH_DELAY_MS = 30;

function trimOutputToMaxChars(
  output: string,
  maxChars: number,
): string {
  if (output.length <= maxChars) {
    return output;
  }

  return output.slice(output.length - maxChars);
}

export class TerminalOutputStore {
  private output = '';
  private version = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly filePath: string,
    private readonly maxOutputChars: number = DEFAULT_MAX_OUTPUT_CHARS,
  ) {}

  reset(): void {
    this.output = '';
    this.version = 0;
    this.flushSync();
  }

  append(data: string): number {
    if (data.length === 0) {
      return this.version;
    }

    this.output = trimOutputToMaxChars(
      `${this.output}${data}`,
      this.maxOutputChars,
    );
    this.version += 1;
    this.scheduleFlush();

    return this.version;
  }

  getSnapshot(): TerminalOutputSnapshot {
    return {
      output: this.output,
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
    fs.writeFileSync(this.filePath, this.output, 'utf8');
  }
}
