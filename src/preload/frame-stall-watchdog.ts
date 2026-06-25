export interface FrameStallWatchdogOptions {
  // 프레임 간격이 이 값(ms) 이상 벌어지면 메인 스레드가 멈춘 것으로 보고 stall을 신고한다.
  thresholdMs: number;
  // stall 감지 시 호출된다. durationMs는 정지가 지속된 시간(ms).
  onStall: (durationMs: number) => void;
}

export interface FrameStallWatchdog {
  stop: () => void;
}

// requestAnimationFrame 콜백 간격을 재서 렌더러 메인 스레드 stall을 감지한다.
// 정상 프레임 간격(~16ms)과 달리, 메인 스레드가 동기 작업으로 막히면 다음 rAF 콜백이
// 그만큼 늦게 호출되므로 그 gap이 곧 정지 시간이 된다.
// 막힌 스레드는 자기 콜스택을 뜰 수 없으므로 여기서는 "언제·얼마나" 멈췄는지만 신고하고,
// 콜스택 캡처는 메인 프로세스의 외부 프로파일러가 담당한다.
export function startFrameStallWatchdog(
  options: FrameStallWatchdogOptions,
): FrameStallWatchdog {
  let lastFrameTime = performance.now();
  let rafId = 0;
  let stopped = false;

  // 백그라운드 탭은 rAF가 throttle/정지되어 gap이 부풀려진다.
  // 다시 보일 때 기준 시각을 리셋해 복귀 직후의 큰 gap을 stall로 오인하지 않는다.
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      lastFrameTime = performance.now();
    }
  };

  const tick = (now: number): void => {
    if (stopped) {
      return;
    }

    // 숨겨진 동안의 gap은 throttle 때문에 신뢰할 수 없으므로 측정에서 제외한다.
    if (document.visibilityState === "visible") {
      const gap = now - lastFrameTime;

      if (gap >= options.thresholdMs) {
        options.onStall(gap);
      }
    }

    lastFrameTime = now;
    rafId = requestAnimationFrame(tick);
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  rafId = requestAnimationFrame(tick);

  return {
    stop: (): void => {
      stopped = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  };
}
