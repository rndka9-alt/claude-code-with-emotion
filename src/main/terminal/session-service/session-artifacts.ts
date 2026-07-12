import fs from "node:fs";
import path from "node:path";

type LogEvent = (message: string) => void;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function clearStaleSessionArtifactDir(
  dir: string,
  logEvent: LogEvent,
): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  let entries: string[] = [];

  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    logEvent(
      `failed to scan stale artifact dir path=${dir} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  for (const entry of entries) {
    const ownerPid = Number.parseInt(entry, 10);

    if (!Number.isNaN(ownerPid) && isProcessAlive(ownerPid)) {
      logEvent(`skipping live-process artifact path=${entry} pid=${ownerPid}`);
      continue;
    }

    const entryPath = path.join(dir, entry);

    removeSessionArtifact(entryPath, logEvent);
  }
}

const STALE_TERMINAL_OUTPUT_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// terminal-output 로그는 앱이 읽지 않는 진단 산출물이라 세션 종료 후에도 남긴다.
// 대신 앱 시작 시 보존 기간이 지난 파일을 지워 무한 누적을 막는다.
export function clearStaleTerminalOutputLogs(
  dir: string,
  logEvent: LogEvent,
  nowMs: number = Date.now(),
): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  let entries: fs.Dirent[] = [];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    logEvent(
      `failed to scan terminal output dir path=${dir} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    let modifiedAtMs: number;

    try {
      modifiedAtMs = fs.statSync(entryPath).mtimeMs;
    } catch (error) {
      logEvent(
        `failed to stat terminal output log path=${entryPath} error=${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (nowMs - modifiedAtMs < STALE_TERMINAL_OUTPUT_LOG_MAX_AGE_MS) {
      continue;
    }

    removeSessionArtifact(entryPath, logEvent);
  }
}

export function removeSessionArtifact(
  artifactPath: string,
  logEvent: LogEvent,
): void {
  const existed = fs.existsSync(artifactPath);

  try {
    fs.rmSync(artifactPath, { force: true, recursive: true });
    logEvent(`removed session artifact path=${artifactPath} existed=${existed}`);
  } catch (error) {
    logEvent(
      `failed to remove session artifact path=${artifactPath} error=${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
