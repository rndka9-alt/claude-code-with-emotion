export interface ForensicsModeState {
  // 감시 모드(stall 추적 계측: watchdog·프로파일러·메트릭 샘플러) 활성 여부.
  enabled: boolean;
}

export interface ForensicsModeBridge {
  getState: () => Promise<ForensicsModeState>;
  setState: (enabled: boolean) => Promise<ForensicsModeState>;
  onStateChange: (
    listener: (state: ForensicsModeState) => void,
  ) => () => void;
}

export const FORENSICS_MODE_CHANNELS: {
  getState: string;
  setState: string;
  stateChanged: string;
} = {
  getState: "forensics-mode:get-state",
  setState: "forensics-mode:set-state",
  stateChanged: "forensics-mode:state-changed",
};
