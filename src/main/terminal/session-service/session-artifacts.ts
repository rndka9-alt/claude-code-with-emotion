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

export function removeSessionArtifact(
  artifactPath: string,
  logEvent: LogEvent,
): void {
  try {
    fs.rmSync(artifactPath, { force: true, recursive: true });
  } catch (error) {
    logEvent(
      `failed to remove session artifact path=${artifactPath} error=${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
