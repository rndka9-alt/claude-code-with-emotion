import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface RuntimeLog {
  readonly filePath: string;
  write: (scope: string, message: string) => void;
  writeError: (scope: string, error: unknown) => void;
}

export function resolveRuntimeLogPath(
  appPath: string,
  userDataPath: string,
  isPackaged: boolean,
): string {
  if (isPackaged) {
    return path.join(userDataPath, 'logs', 'electron-runtime.log');
  }

  return path.join(appPath, '.runtime-logs', 'electron-dev.log');
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
    if (typeof error.stack === 'string' && error.stack.length > 0) {
      return error.stack;
    }

    return error.message;
  }

  return String(error);
}

export function createRuntimeLog(filePath: string): RuntimeLog {
  ensureLogDirExists(filePath);

  return {
    filePath,
    write: (scope, message) => {
      appendFileSync(filePath, formatRuntimeLogLine(scope, message), 'utf8');
    },
    writeError: (scope, error) => {
      appendFileSync(
        filePath,
        formatRuntimeLogLine(scope, stringifyError(error)),
        'utf8',
      );
    },
  };
}
