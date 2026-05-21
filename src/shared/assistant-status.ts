import { z } from "zod";

// 여기엔 순수 lifecycle 상태만 둔다. 기분·감정 토큰(happy/sad/surprised) 은
// AssistantEmotionalState 전담 영역이라 여기 넣으면 카테고리 혼용이 댐.
// 훅은 이제 state+emotion 두 축을 따로 emit 한다.
const INITIAL_ASSISTANT_SNAPSHOTS_ARGUMENT_PREFIX =
  "--initial-assistant-snapshots=";

export const assistantSemanticStateSchema = z.enum([
  "disconnected",
  "thinking",
  "working",
  "waiting",
  "permission_wait",
  "tool_failed",
  "compacting",
  "completed",
  "error",
]);

export const assistantEmotionalStateSchema = z.enum([
  "angry",
  "annoyed",
  "bored",
  "confused",
  "contemptuous",
  "crying",
  "curious",
  "determined",
  "dumbfounded",
  "embarrassed",
  "excited",
  "exhausted",
  "happy",
  "laughing",
  "nervous",
  "neutral",
  "proud",
  "sad",
  "scared",
  "serious",
  "shy",
  "smile",
  "smirk",
  "smug",
  "surprised",
]);

const assistantStatusIntensitySchema = z.enum(["low", "medium", "high"]);
const assistantStatusSnapshotSchema = z.object({
  activityLabel: z.string(),
  assistantProviderId: z.string().min(1).optional(),
  emotion: assistantEmotionalStateSchema.nullable(),
  overlayLine: z.string().nullable(),
  state: assistantSemanticStateSchema,
  line: z.string(),
  currentTask: z.string(),
  updatedAtMs: z.number().finite(),
  intensity: assistantStatusIntensitySchema,
  source: z.string(),
});

export type AssistantSemanticState = z.infer<
  typeof assistantSemanticStateSchema
>;

export type AssistantEmotionalState = z.infer<
  typeof assistantEmotionalStateSchema
>;

export type AssistantStatusIntensity = z.infer<
  typeof assistantStatusIntensitySchema
>;

export interface AssistantStatusUpdate {
  activityLabel?: string;
  assistantProviderId?: string;
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

export type AssistantStatusSnapshot = z.infer<
  typeof assistantStatusSnapshotSchema
>;

export type AssistantSnapshotsBySessionId = Record<
  string,
  AssistantStatusSnapshot
>;

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
    assistantProviderId: "claude",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAssistantStatusSnapshot(
  value: unknown,
): AssistantStatusSnapshot {
  const result = assistantStatusSnapshotSchema.safeParse(value);

  if (!result.success) {
    throw new Error("Assistant status snapshot payload is invalid.");
  }

  return result.data;
}

export function parseAssistantSnapshotsBySessionId(
  value: unknown,
): AssistantSnapshotsBySessionId {
  if (!isRecord(value)) {
    throw new Error("Assistant snapshots payload must be an object.");
  }

  const snapshotsBySessionId: AssistantSnapshotsBySessionId = {};

  for (const [sessionId, snapshot] of Object.entries(value)) {
    snapshotsBySessionId[sessionId] = parseAssistantStatusSnapshot(snapshot);
  }

  return snapshotsBySessionId;
}

export function createInitialAssistantSnapshotsBySessionIdArgument(
  snapshotsBySessionId: AssistantSnapshotsBySessionId,
): string {
  return `${INITIAL_ASSISTANT_SNAPSHOTS_ARGUMENT_PREFIX}${encodeURIComponent(
    JSON.stringify(snapshotsBySessionId),
  )}`;
}

export function parseInitialAssistantSnapshotsBySessionIdFromArguments(
  args: string[],
): AssistantSnapshotsBySessionId | undefined {
  const argument = args.find((candidate) =>
    candidate.startsWith(INITIAL_ASSISTANT_SNAPSHOTS_ARGUMENT_PREFIX),
  );

  if (argument === undefined) {
    return undefined;
  }

  const encodedValue = argument.slice(
    INITIAL_ASSISTANT_SNAPSHOTS_ARGUMENT_PREFIX.length,
  );
  const parsed: unknown = JSON.parse(decodeURIComponent(encodedValue));

  return parseAssistantSnapshotsBySessionId(parsed);
}
