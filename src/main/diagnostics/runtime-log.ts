import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { RuntimeDiagnosticPayload } from "../../shared/diagnostics";

export interface RuntimeLog {
  readonly filePath: string;
  write: (scope: string, message: string) => void;
  writeError: (scope: string, error: unknown) => void;
}

type RuntimeLogListener = (payload: RuntimeDiagnosticPayload) => void;

export function resolveRuntimeLogPath(
  appPath: string,
  userDataPath: string,
  isPackaged: boolean,
): string {
  if (isPackaged) {
    return path.join(userDataPath, "logs", "electron-runtime.log");
  }

  return path.join(appPath, ".runtime-logs", "electron-dev.log");
}

export function formatRuntimeLogLine(
  scope: string,
  message: string,
  now: Date = new Date(),
): string {
  return `[${now.toISOString()}] [${scope}] ${message}\n`;
}

function ensureLogDirExists(filePath: string): void {
  const directory = path.dirname(filePath);

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    if (typeof error.stack === "string" && error.stack.length > 0) {
      return error.stack;
    }

    return error.message;
  }

  return String(error);
}

function emitRuntimeLogListener(
  listener: RuntimeLogListener | undefined,
  scope: string,
  message: string,
  now: Date,
): void {
  listener?.({
    scope,
    message,
    timestamp: now.toISOString(),
  });
}

export function createRuntimeLog(
  filePath: string,
  listener?: RuntimeLogListener,
): RuntimeLog {
  ensureLogDirExists(filePath);

  return {
    filePath,
    write: (scope, message) => {
      const now = new Date();

      appendFileSync(
        filePath,
        formatRuntimeLogLine(scope, message, now),
        "utf8",
      );
      emitRuntimeLogListener(listener, scope, message, now);
    },
    writeError: (scope, error) => {
      const now = new Date();
      const message = stringifyError(error);

      appendFileSync(
        filePath,
        formatRuntimeLogLine(scope, message, now),
        "utf8",
      );
      emitRuntimeLogListener(listener, scope, message, now);
    },
  };
}
