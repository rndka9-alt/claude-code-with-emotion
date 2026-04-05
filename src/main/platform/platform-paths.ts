import path from "node:path";

// PATH 등 경로 리스트 환경변수는 OS 마다 구분자가 다르다(macOS/Linux `:`, Windows `;`).
// 하드코딩된 `:` 을 `path.delimiter` 로 일원화해 플랫폼 중립 층을 만든다.
export function splitPathList(
  value: string | null | undefined,
): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  return value.split(path.delimiter);
}

export function joinPathList(segments: readonly string[]): string {
  return segments.join(path.delimiter);
}

// Unix 계열은 HOME 을, 윈도우는 USERPROFILE(또는 HOMEDRIVE+HOMEPATH) 를 쓴다.
// 호출부가 `env.HOME` 을 직접 읽는 걸 막고, 플랫폼 차이를 이 함수 안으로 모은다.
export function resolveHomeDir(
  env: Record<string, string | undefined>,
): string | undefined {
  const home = env.HOME;

  if (typeof home === "string" && home.length > 0) {
    return home;
  }

  const userProfile = env.USERPROFILE;

  if (typeof userProfile === "string" && userProfile.length > 0) {
    return userProfile;
  }

  const homeDrive = env.HOMEDRIVE;
  const homePath = env.HOMEPATH;

  if (
    typeof homeDrive === "string" &&
    homeDrive.length > 0 &&
    typeof homePath === "string" &&
    homePath.length > 0
  ) {
    return `${homeDrive}${homePath}`;
  }

  return undefined;
}
