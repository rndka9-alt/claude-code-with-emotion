import fs from "node:fs";
import path from "node:path";
import {
  rotateRuntimeLogIfNeeded,
  type RuntimeLogRotationOptions,
} from "../../diagnostics";

const OUTPUT_FLUSH_DELAY_MS = 30;
// CR 스피너처럼 잠잠해지지 않는 스트림에서는 디바운스가 계속 밀리므로,
// 버퍼가 이 크기를 넘으면 즉시 기록해 메모리 누적을 막는다.
const OUTPUT_FLUSH_THRESHOLD_CHARS = 256 * 1024;
// 이 로그는 앱이 읽지 않는 진단용 산출물이다(재부착 복구는 TerminalEmulatorState 스냅샷 담당).
// LF 없는 TUI 출력도 무한히 쌓이지 않도록 세션당 현재 파일 + .1 세대 하나로 상한한다.
const OUTPUT_LOG_ROTATION: RuntimeLogRotationOptions = {
  maxBytes: 8 * 1024 * 1024,
  maxFiles: 1,
};

export class TerminalOutputStore {
  private version = 0;
  private pendingChunks: string[] = [];
  private pendingChars = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly filePath: string) {}

  reset(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.version = 0;
    this.pendingChunks = [];
    this.pendingChars = 0;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, "", "utf8");
    fs.rmSync(`${this.filePath}.1`, { force: true });
  }

  append(data: string): number {
    if (data.length === 0) {
      return this.version;
    }

    this.version += 1;
    this.pendingChunks.push(data);
    this.pendingChars += data.length;

    if (this.pendingChars >= OUTPUT_FLUSH_THRESHOLD_CHARS) {
      this.flushSync();
    } else {
      this.scheduleFlush();
    }

    return this.version;
  }

  getVersion(): number {
    return this.version;
  }

  dispose(): void {
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
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingChunks.length === 0) {
      return;
    }

    const chunk = this.pendingChunks.join("");

    this.pendingChunks = [];
    this.pendingChars = 0;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    rotateRuntimeLogIfNeeded(this.filePath, OUTPUT_LOG_ROTATION);
    fs.appendFileSync(this.filePath, chunk, "utf8");
  }
}
