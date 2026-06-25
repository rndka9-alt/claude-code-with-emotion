// FORENSICS 진단 계측의 토글과 공유 임계값.
// 렌더러(preload watchdog)와 메인(stall detector·recorder)이 같은 기준을 참조하도록
// stall 판정값을 한 곳에서 정의한다.

// 계측을 켜는 환경변수 이름. 값이 "1" 또는 "true"일 때만 watchdog·프로파일러가 가동된다.
// 평소(플래그 꺼짐)에는 어떤 계측도 시작하지 않아 런타임 오버헤드가 없다.
export const FORENSICS_ENV_FLAG = "FORENSICS";

// stall 판정 임계값(ms). 메인 스레드가 이 시간 이상 멈추면 프로파일 슬라이스를 덤프한다.
export const FORENSICS_STALL_THRESHOLD_MS = 2000;

export function isForensicsFlagEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true";
}
