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
  emotion: AssistantEmotionalState | null;
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
    emotion: null,
    state: 'disconnected',
    line: 'Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!',
    currentTask: 'Waiting for Claude to start',
    updatedAtMs: nowMs,
    intensity: 'low',
    source: 'app',
  };
}
