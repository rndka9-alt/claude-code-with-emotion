import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface CpuProfileMeta {
  // 정지가 감지된 시각(ISO 8601). 파일명에 박아 느린 케이스를 바로 식별한다.
  detectedAt: string;
  // 정지가 지속된 시간(ms).
  durationMs: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// CDP Profiler.stop 응답에서 .cpuprofile로 저장 가능한 profile만 안전하게 꺼낸다.
// webContents.debugger.sendCommand 반환은 any이므로 형태를 런타임에 검증한다.
// 최소한 노드 트리(nodes 배열)가 있어야 DevTools Performance 패널이 읽을 수 있다.
export function extractCpuProfile(commandResult: unknown): unknown | null {
  if (!isRecord(commandResult)) {
    return null;
  }

  const { profile } = commandResult;

  if (!isRecord(profile) || !Array.isArray(profile.nodes)) {
    return null;
  }

  return profile;
}

// profile JSON을 .cpuprofile 파일로 저장하고 경로를 반환한다.
// 파일은 DevTools Performance 패널에 그대로 드래그해 콜스택 트리를 열 수 있다.
export function writeCpuProfile(
  directory: string,
  kind: string,
  profile: unknown,
  meta: CpuProfileMeta,
): string {
  mkdirSync(directory, { recursive: true });

  // ISO 타임스탬프의 콜론·점은 파일명에 부적합하므로 하이픈으로 치환한다.
  const safeTimestamp = meta.detectedAt.replace(/[:.]/g, "-");
  const fileName = `${kind}-${safeTimestamp}-${Math.round(meta.durationMs)}ms.cpuprofile`;
  const filePath = path.join(directory, fileName);

  writeFileSync(filePath, JSON.stringify(profile), "utf8");

  return filePath;
}
