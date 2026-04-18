// 여기엔 순수 lifecycle 상태만 둔다. 기분·감정 토큰(happy/sad/surprised) 은
// AssistantEmotionalState 전담 영역이라 여기 넣으면 카테고리 혼용이 댐.
// 훅은 이제 state+emotion 두 축을 따로 emit 한다.
export type AssistantSemanticState =
  | "disconnected"
  | "thinking"
  | "working"
  | "waiting"
  | "permission_wait"
  | "tool_failed"
  | "compacting"
  | "completed"
  | "error";

export type AssistantEmotionalState =
  | "angry"
  | "annoyed"
  | "bored"
  | "confused"
  | "contemptuous"
  | "crying"
  | "curious"
  | "dumbfounded"
  | "embarrassed"
  | "excited"
  | "exhausted"
  | "happy"
  | "laughing"
  | "nervous"
  | "neutral"
  | "proud"
  | "sad"
  | "scared"
  | "serious"
  | "shy"
  | "smile"
  | "smirk"
  | "smug"
  | "surprised";

export type AssistantStatusIntensity = "low" | "medium" | "high";

export interface AssistantStatusUpdate {
  activityLabel?: string;
  emotion?: AssistantEmotionalState;
  state: AssistantSemanticState;
  line: string;
  currentTask?: string;
  intensity?: AssistantStatusIntensity;
}

/*
 * This overlay contract is intentionally tiny for now. The current phase only
 * uses `emotion`, but `line` is reserved so a future MCP surface can override
 * the one-line utterance without redesigning the storage pipeline again.
 */
export interface AssistantVisualOverlayUpdate {
  emotion?: AssistantEmotionalState | null;
  line?: string | null;
}

export interface AssistantStatusSnapshot {
  activityLabel: string;
  emotion: AssistantEmotionalState | null;
  overlayLine: string | null;
  state: AssistantSemanticState;
  line: string;
  currentTask: string;
  updatedAtMs: number;
  intensity: AssistantStatusIntensity;
  source: string;
}

export interface AssistantStatusBridge {
  getSnapshot: (
    request: AssistantStatusSnapshotRequest,
  ) => Promise<AssistantStatusSnapshot>;
  onSnapshot: (
    request: AssistantStatusSnapshotRequest,
    listener: (snapshot: AssistantStatusSnapshot) => void,
  ) => () => void;
}

export interface AssistantStatusSnapshotRequest {
  sessionId: string;
}

export interface AssistantStatusSnapshotEvent {
  sessionId: string;
  snapshot: AssistantStatusSnapshot;
}

export const ASSISTANT_STATUS_CHANNELS: {
  getSnapshot: string;
  snapshot: string;
} = {
  getSnapshot: "assistant-status:get-snapshot",
  snapshot: "assistant-status:snapshot",
};

export function createDefaultAssistantStatusSnapshot(
  nowMs: number,
): AssistantStatusSnapshot {
  return {
    activityLabel: "연결 대기 중",
    emotion: null,
    overlayLine: null,
    state: "disconnected",
    line: "Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!",
    currentTask: "Waiting for Claude to start",
    updatedAtMs: nowMs,
    intensity: "low",
    source: "app",
  };
}
