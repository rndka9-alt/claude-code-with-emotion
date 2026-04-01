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
    state: 'disconnected',
    line: 'Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!',
    currentTask: 'Waiting for Claude to start',
    updatedAtMs: nowMs,
    intensity: 'low',
    source: 'app',
  };
}
