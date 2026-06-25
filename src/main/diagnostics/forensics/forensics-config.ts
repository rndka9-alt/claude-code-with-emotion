import path from "node:path";
import {
  FORENSICS_ENV_FLAG,
  isForensicsFlagEnabled,
} from "../../../shared/forensics";

// 메인 스레드 stall 폴링 간격(ms). 임계값보다 충분히 작아야 정지를 빠르게 포착한다.
export const MAIN_STALL_POLL_INTERVAL_MS = 250;

// app.getAppMetrics() 샘플 간격(ms). 프로세스별 CPU·메모리 추세를 stall 시점과 대조한다.
export const APP_METRICS_SAMPLE_INTERVAL_MS = 5000;

// CPU 프로파일러 샘플링 간격(마이크로초). 작을수록 콜스택 해상도가 오르지만 오버헤드가 는다.
export const CPU_PROFILER_SAMPLING_INTERVAL_MICROS = 200;

export function isForensicsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isForensicsFlagEnabled(env[FORENSICS_ENV_FLAG]);
}

// 프로파일·메트릭 산출물을 모으는 디렉토리. runtime 로그 옆 forensics/ 하위에 둔다.
export function resolveForensicsDirectory(
  appPath: string,
  userDataPath: string,
  isPackaged: boolean,
): string {
  if (isPackaged) {
    return path.join(userDataPath, "logs", "forensics");
  }

  return path.join(appPath, ".runtime-logs", "forensics");
}
