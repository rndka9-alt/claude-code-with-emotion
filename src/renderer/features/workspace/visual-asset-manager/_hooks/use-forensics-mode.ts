import { useEffect, useState } from "react";

export interface ForensicsModeControls {
  // claudeApp bridge가 없는 환경(테스트 등)에서는 토글을 숨기기 위한 가용 여부.
  isAvailable: boolean;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

// 감시 모드(stall 추적 계측) on/off를 메인과 동기화하는 훅.
// 초기값은 getState로 받고, 다른 창에서 토글해도 onStateChange broadcast로 따라온다.
export function useForensicsMode(): ForensicsModeControls {
  const forensics = window.claudeApp?.forensics;
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (forensics === undefined) {
      return;
    }

    let isActive = true;

    void forensics.getState().then((state) => {
      if (isActive) {
        setIsEnabled(state.enabled);
      }
    });

    const unsubscribe = forensics.onStateChange((state) => {
      setIsEnabled(state.enabled);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [forensics]);

  return {
    isAvailable: forensics !== undefined,
    isEnabled,
    setEnabled: (enabled) => {
      if (forensics === undefined) {
        return;
      }

      // 낙관적 업데이트: 응답을 기다리지 않고 즉시 반영하고, broadcast로도 재동기화된다.
      setIsEnabled(enabled);
      void forensics.setState(enabled);
    },
  };
}
