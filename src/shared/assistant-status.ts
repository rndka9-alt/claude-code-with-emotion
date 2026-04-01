export type AssistantSemanticState =
  | 'disconnected'
  | 'idle'
  | 'thinking'
  | 'working'
  | 'responding'
  | 'waiting'
  | 'surprised'
  | 'sad'
  | 'happy'
  | 'error';

export type AssistantEmotionalState =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised';

export type AssistantStatusIntensity = 'low' | 'medium' | 'high';

export interface AssistantStatusUpdate {
  activityLabel?: string;
  emotion?: AssistantEmotionalState;
  state: AssistantSemanticState;
  line: string;
  currentTask?: string;
  durationMs?: number;
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
  ) => (() => void);
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
  getSnapshot: 'assistant-status:get-snapshot',
  snapshot: 'assistant-status:snapshot',
};

export function createDefaultAssistantStatusSnapshot(
  nowMs: number,
): AssistantStatusSnapshot {
  return {
    activityLabel: '연결 대기 중',
    emotion: null,
    overlayLine: null,
    state: 'disconnected',
    line: 'Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!',
    currentTask: 'Waiting for Claude to start',
    updatedAtMs: nowMs,
    intensity: 'low',
    source: 'app',
  };
}
