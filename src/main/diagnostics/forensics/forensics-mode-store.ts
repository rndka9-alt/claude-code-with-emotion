import fs from "node:fs";
import path from "node:path";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// 디스크에 저장된 감시 모드 상태를 읽는다. 파일이 없거나(첫 실행) 형태가 깨졌으면 기본값 false.
function parseEnabledFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): boolean {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);

    if (!isObjectRecord(parsed) || typeof parsed.enabled !== "boolean") {
      logEvent?.("forensics mode state on disk had an invalid shape");
      return false;
    }

    return parsed.enabled;
  } catch (error) {
    // 파일이 아직 없는 첫 실행(ENOENT)은 정상 흐름이므로 조용히 기본값을 쓴다.
    if (error instanceof Error && error.name !== "ENOENT") {
      logEvent?.(`failed to read forensics mode state: ${error.message}`);
    }

    return false;
  }
}

// 감시 모드 on/off 상태를 userData에 영속한다(앱 재시작 후에도 유지).
export class ForensicsModeStore {
  private enabled: boolean;

  constructor(
    private readonly filePath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.enabled = parseEnabledFromDisk(filePath, logEvent);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(nextEnabled: boolean): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify({ enabled: nextEnabled }, null, 2),
      "utf8",
    );
    this.enabled = nextEnabled;
    this.logEvent?.(`saved forensics mode enabled=${nextEnabled}`);
  }
}
