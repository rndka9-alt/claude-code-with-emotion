export type AssistantSemanticState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'responding'
  | 'waiting'
  | 'surprised'
  | 'sad'
  | 'happy'
  | 'error';

export type AssistantStatusIntensity = 'low' | 'medium' | 'high';

export interface AssistantStatusUpdate {
  state: AssistantSemanticState;
  line: string;
  currentTask?: string;
  durationMs?: number;
  intensity?: AssistantStatusIntensity;
}

export interface AssistantStatusSnapshot {
  state: AssistantSemanticState;
  line: string;
  currentTask: string;
  updatedAtMs: number;
  intensity: AssistantStatusIntensity;
  source: string;
}

export interface AssistantStatusBridge {
  getSnapshot: () => Promise<AssistantStatusSnapshot>;
  onSnapshot: (
    listener: (snapshot: AssistantStatusSnapshot) => void,
  ) => (() => void);
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
    state: 'idle',
    line: '세션 대기 중이에요. 말 걸리면 바로 움직여요...!',
    currentTask: 'Waiting for assistant activity',
    updatedAtMs: nowMs,
    intensity: 'low',
    source: 'app',
  };
}
