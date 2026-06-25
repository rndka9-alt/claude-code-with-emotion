export interface MainStallDetectorOptions {
  // 타이머 콜백 지연이 이 값(ms) 이상이면 stall로 신고한다.
  thresholdMs: number;
  pollIntervalMs: number;
  onStall: (durationMs: number) => void;
}

export interface MainStallDetector {
  stop: () => void;
}

// setInterval 콜백이 예정 시각보다 늦게 호출되면, 그 지연만큼 메인 스레드(이벤트 루프)가
// 동기 작업에 점유돼 막혀 있었다는 뜻이다. drift를 정지 시간으로 환산해 신고한다.
export function startMainStallDetector(
  options: MainStallDetectorOptions,
): MainStallDetector {
  let expectedTickAt = Date.now() + options.pollIntervalMs;

  const timer = setInterval(() => {
    const now = Date.now();
    const driftMs = now - expectedTickAt;

    if (driftMs >= options.thresholdMs) {
      options.onStall(driftMs);
    }

    // 누적 drift를 막기 위해 다음 기대 시각은 현재 기준으로 갱신한다.
    expectedTickAt = now + options.pollIntervalMs;
  }, options.pollIntervalMs);

  timer.unref();

  return {
    stop: (): void => {
      clearInterval(timer);
    },
  };
}
