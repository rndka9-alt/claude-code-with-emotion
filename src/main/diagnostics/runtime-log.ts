import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import type { RuntimeDiagnosticPayload } from "../../shared/diagnostics";

export interface RuntimeLog {
  readonly filePath: string;
  write: (scope: string, message: string) => void;
  writeError: (scope: string, error: unknown) => void;
}

export interface RuntimeLogRotationOptions {
  readonly maxBytes: number;
  readonly maxFiles: number;
}

// 기본 회전 정책: 5MB 넘으면 밀어내고, .1~.3 세대만 보관(오래된 건 삭제)
export const DEFAULT_RUNTIME_LOG_ROTATION: RuntimeLogRotationOptions = {
  maxBytes: 5 * 1024 * 1024,
  maxFiles: 3,
};

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

// maxFiles < 1 이면 세대 보관 없이 그냥 잘라내기만 수행한다
export function rotateRuntimeLogIfNeeded(
  filePath: string,
  options: RuntimeLogRotationOptions,
): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  const { size } = statSync(filePath);

  if (size < options.maxBytes) {
    return false;
  }

  if (options.maxFiles < 1) {
    rmSync(filePath, { force: true });
    return true;
  }

  // 오래된 세대부터 뒤로 밀어낸다 — maxFiles 번째 세대는 덮어쓰지 말고 삭제
  for (let index = options.maxFiles; index >= 1; index -= 1) {
    const current = `${filePath}.${index}`;

    if (!existsSync(current)) {
      continue;
    }

    if (index === options.maxFiles) {
      rmSync(current, { force: true });
    } else {
      renameSync(current, `${filePath}.${index + 1}`);
    }
  }

  renameSync(filePath, `${filePath}.1`);
  return true;
}

export function createRuntimeLog(
  filePath: string,
  listener?: RuntimeLogListener,
  rotation: RuntimeLogRotationOptions = DEFAULT_RUNTIME_LOG_ROTATION,
): RuntimeLog {
  ensureLogDirExists(filePath);

  const appendLine = (scope: string, message: string) => {
    const now = new Date();

    rotateRuntimeLogIfNeeded(filePath, rotation);
    appendFileSync(
      filePath,
      formatRuntimeLogLine(scope, message, now),
      "utf8",
    );
    emitRuntimeLogListener(listener, scope, message, now);
  };

  return {
    filePath,
    write: (scope, message) => {
      appendLine(scope, message);
    },
    writeError: (scope, error) => {
      appendLine(scope, stringifyError(error));
    },
  };
}
