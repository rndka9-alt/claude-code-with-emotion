import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal } from "@xterm/headless";
import { DEFAULT_TERMINAL_HISTORY_LINES } from "../../../shared/terminal-history";

export class TerminalEmulatorState {
  private readonly serializeAddon = new SerializeAddon();
  private readonly terminal: Terminal;
  private cachedSnapshot = "";
  private pendingTask: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(cols: number, rows: number) {
    this.terminal = new Terminal({
      allowProposedApi: true,
      convertEol: false,
      scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
      cols: Math.max(2, cols),
      rows: Math.max(1, rows),
    });
    this.terminal.loadAddon(this.serializeAddon);
  }

  resize(cols: number, rows: number): void {
    this.enqueue(() => {
      this.terminal.resize(Math.max(2, cols), Math.max(1, rows));
      this.updateSnapshot();
    });
  }

  write(data: string): void {
    if (data.length === 0) {
      return;
    }

    this.enqueue(() => {
      return new Promise((resolve) => {
        this.terminal.write(data, () => {
          this.updateSnapshot();
          resolve();
        });
      });
    });
  }

  async getSnapshot(): Promise<string> {
    await this.pendingTask;

    return this.cachedSnapshot;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.serializeAddon.dispose();
    this.terminal.dispose();
  }

  private enqueue(task: () => void | Promise<void>): void {
    this.pendingTask = this.pendingTask.then(async () => {
      if (this.disposed) {
        return;
      }

      await task();
    });
  }

  private updateSnapshot(): void {
    this.cachedSnapshot = this.serializeAddon.serialize({
      scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
    });
  }
}
