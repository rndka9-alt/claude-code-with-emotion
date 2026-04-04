import type {
  AssistantEmotionalState,
  AssistantSemanticState,
} from "./assistant-status";

export type VisualPresetCategory = "state" | "emotion";

export type VisualStatePresetId =
  | "disconnected"
  | "idle"
  | "thinking"
  | "working"
  | "responding"
  | "waiting"
  | "permission_wait"
  | "interrupted"
  | "completed"
  | "error"
  | "tool_failed";

export type VisualEmotionPresetId =
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

export interface VisualStatePreset {
  category: "state";
  defaultLine: string;
  description: string;
  id: VisualStatePresetId;
  label: string;
  source: "assistant-hook" | "synthetic";
}

export interface VisualEmotionPreset {
  category: "emotion";
  description: string;
  id: VisualEmotionPresetId;
  label: string;
}

export interface VisualSelection {
  emotion: VisualEmotionPresetId | null;
  state: VisualStatePresetId;
}

/*
 * These preset ids are intentionally stable because the current Claude Code hook
 * pipeline already emits coarse lifecycle states that the status panel depends on.
 * The asset system should translate from those hook-oriented states into user
 * imagery, not invent a second unrelated vocabulary.
 */
export const STATE_PRESETS: ReadonlyArray<VisualStatePreset> = [
  {
    category: "state",
    defaultLine: "Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!",
    description: "No Claude session is attached to the workspace yet.",
    id: "disconnected",
    label: "Disconnected",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "잠깐 숨 고르는 중이에요...!",
    description:
      "Claude is connected but not doing anything visible right now.",
    id: "idle",
    label: "Idle",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "질문 읽고 흐름 잡는 중이에요...!",
    description: "Claude is reading the prompt or planning the next move.",
    id: "thinking",
    label: "Thinking",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "손 움직이는 중이에요. 파일이랑 로그를 뒤져보는 중...!",
    description: "Claude is actively using tools or making a concrete change.",
    id: "working",
    label: "Working",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "답변 정리해서 보내는 중이에요...!",
    description:
      "Claude is composing or streaming a response back to the user.",
    id: "responding",
    label: "Responding",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "다음 입력이나 신호를 기다리는 중이에요.",
    description: "Claude is paused and waiting for the next user action.",
    id: "waiting",
    label: "Waiting",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "권한 허용이 필요해서 여기서 잠깐 멈췃어요.",
    description:
      "Claude is blocked on a permission prompt before tool work can continue.",
    id: "permission_wait",
    label: "Permission Wait",
    source: "synthetic",
  },
  {
    category: "state",
    defaultLine: "작업이 중간에 멈췃어요. 흐름 다시 잡아볼게요.",
    description:
      "Claude work stopped because the user interrupted the current turn.",
    id: "interrupted",
    label: "Interrupted",
    source: "synthetic",
  },
  {
    category: "state",
    defaultLine: "작업 마무리 완료예요...!",
    description:
      "A task or turn finished successfully and is now settling back down.",
    id: "completed",
    label: "Completed",
    source: "synthetic",
  },
  {
    category: "state",
    defaultLine: "오류가 나서 상태를 점검하는 중이에요.",
    description: "Claude hit a terminal or hook-level error condition.",
    id: "error",
    label: "Error",
    source: "assistant-hook",
  },
  {
    category: "state",
    defaultLine: "툴이 한번 삐끗햇어요. 원인 다시 볼게요.",
    description:
      "A tool attempt failed even though the broader session is still alive.",
    id: "tool_failed",
    label: "Tool Failed",
    source: "synthetic",
  },
];

export const EMOTION_PRESETS: ReadonlyArray<VisualEmotionPreset> = [
  {
    category: "emotion",
    description: "Rage from repeated failures or serious problems.",
    id: "angry",
    label: "Angry",
  },
  {
    category: "emotion",
    description: "Mild irritation from minor interruptions or nuisances.",
    id: "annoyed",
    label: "Annoyed",
  },
  {
    category: "emotion",
    description: "Disengaged during repetitive or mundane work.",
    id: "bored",
    label: "Bored",
  },
  {
    category: "emotion",
    description: "Puzzled by unexpected results or unclear situations.",
    id: "confused",
    label: "Confused",
  },
  {
    category: "emotion",
    description: "Disdain toward terrible code or absurd situations.",
    id: "contemptuous",
    label: "Contemptuous",
  },
  {
    category: "emotion",
    description: "Overwhelmed to tears by cascading errors.",
    id: "crying",
    label: "Crying",
  },
  {
    category: "emotion",
    description: "Intrigued and digging into an interesting problem.",
    id: "curious",
    label: "Curious",
  },
  {
    category: "emotion",
    description: "Speechless from something utterly absurd.",
    id: "dumbfounded",
    label: "Dumbfounded",
  },
  {
    category: "emotion",
    description: "Flustered after making a mistake or being wrong.",
    id: "embarrassed",
    label: "Embarrassed",
  },
  {
    category: "emotion",
    description: "Thrilled about a fun task or major breakthrough.",
    id: "excited",
    label: "Excited",
  },
  {
    category: "emotion",
    description: "Drained after a long and complex task.",
    id: "exhausted",
    label: "Exhausted",
  },
  {
    category: "emotion",
    description: "A positive completion or upbeat reaction.",
    id: "happy",
    label: "Happy",
  },
  {
    category: "emotion",
    description: "Cracking up at something ridiculous or delightful.",
    id: "laughing",
    label: "Laughing",
  },
  {
    category: "emotion",
    description: "Tense before a risky operation like force push.",
    id: "nervous",
    label: "Nervous",
  },
  {
    category: "emotion",
    description: "No extra emotional coloring is being applied.",
    id: "neutral",
    label: "Neutral",
  },
  {
    category: "emotion",
    description: "Satisfied after solving a difficult problem well.",
    id: "proud",
    label: "Proud",
  },
  {
    category: "emotion",
    description: "A blocked, regretful, or otherwise downbeat tone.",
    id: "sad",
    label: "Sad",
  },
  {
    category: "emotion",
    description: "Terrified by a fatal error or irreversible situation.",
    id: "scared",
    label: "Scared",
  },
  {
    category: "emotion",
    description: "Focused and no-nonsense during critical work.",
    id: "serious",
    label: "Serious",
  },
  {
    category: "emotion",
    description: "Bashful when complimented or in an awkward spot.",
    id: "shy",
    label: "Shy",
  },
  {
    category: "emotion",
    description: "A gentle, content expression of mild satisfaction.",
    id: "smile",
    label: "Smile",
  },
  {
    category: "emotion",
    description: "A sly grin hinting at something up the sleeve.",
    id: "smirk",
    label: "Smirk",
  },
  {
    category: "emotion",
    description: 'Self-satisfied "told you so" swagger.',
    id: "smug",
    label: "Smug",
  },
  {
    category: "emotion",
    description: "A sudden alert or unexpected development.",
    id: "surprised",
    label: "Surprised",
  },
];

export function isVisualStatePresetId(value: string): boolean {
  return STATE_PRESETS.some((preset) => preset.id === value);
}

export function isVisualEmotionPresetId(value: string): boolean {
  return EMOTION_PRESETS.some((preset) => preset.id === value);
}

export function getDefaultVisualStateLine(state: VisualStatePresetId): string {
  return (
    STATE_PRESETS.find((preset) => preset.id === state)?.defaultLine ??
    "오류가 나서 상태를 점검하는 중이에요."
  );
}

/*
 * The current runtime still exposes a single semantic state token. This bridge
 * keeps the existing hook outputs working while preparing the image system for a
 * future two-axis `state + emotion` contract.
 */
export function normalizeAssistantSemanticState(
  state: AssistantSemanticState,
): VisualSelection {
  if (state === "disconnected") {
    return { state: "disconnected", emotion: null };
  }

  if (state === "idle") {
    return { state: "idle", emotion: null };
  }

  if (state === "thinking") {
    return { state: "thinking", emotion: null };
  }

  if (state === "working") {
    return { state: "working", emotion: null };
  }

  if (state === "responding") {
    return { state: "responding", emotion: null };
  }

  if (state === "waiting") {
    return { state: "waiting", emotion: null };
  }

  if (state === "surprised") {
    return { state: "waiting", emotion: "surprised" };
  }

  if (state === "sad") {
    return { state: "waiting", emotion: "sad" };
  }

  if (state === "happy") {
    return { state: "completed", emotion: "happy" };
  }

  return { state: "error", emotion: null };
}

export function normalizeAssistantVisualSelection(input: {
  emotion?: AssistantEmotionalState | null;
  state: AssistantSemanticState;
}): VisualSelection {
  const normalizedSelection = normalizeAssistantSemanticState(input.state);

  if (
    input.emotion === undefined ||
    input.emotion === null ||
    input.emotion === "neutral"
  ) {
    return normalizedSelection;
  }

  return {
    state: normalizedSelection.state,
    emotion: input.emotion,
  };
}
