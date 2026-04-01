import type { AssistantSemanticState } from './assistant-status';

export type VisualPresetCategory = 'state' | 'emotion';

export type VisualStatePresetId =
  | 'disconnected'
  | 'idle'
  | 'thinking'
  | 'working'
  | 'responding'
  | 'waiting'
  | 'permission_wait'
  | 'interrupted'
  | 'completed'
  | 'error'
  | 'tool_failed';

export type VisualEmotionPresetId =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised';

export interface VisualStatePreset {
  category: 'state';
  description: string;
  id: VisualStatePresetId;
  label: string;
  source: 'assistant-hook' | 'synthetic';
}

export interface VisualEmotionPreset {
  category: 'emotion';
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
    category: 'state',
    description: 'No Claude session is attached to the workspace yet.',
    id: 'disconnected',
    label: 'Disconnected',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is connected but not doing anything visible right now.',
    id: 'idle',
    label: 'Idle',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is reading the prompt or planning the next move.',
    id: 'thinking',
    label: 'Thinking',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is actively using tools or making a concrete change.',
    id: 'working',
    label: 'Working',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is composing or streaming a response back to the user.',
    id: 'responding',
    label: 'Responding',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is paused and waiting for the next user action.',
    id: 'waiting',
    label: 'Waiting',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'Claude is blocked on a permission prompt before tool work can continue.',
    id: 'permission_wait',
    label: 'Permission Wait',
    source: 'synthetic',
  },
  {
    category: 'state',
    description: 'Claude work stopped because the user interrupted the current turn.',
    id: 'interrupted',
    label: 'Interrupted',
    source: 'synthetic',
  },
  {
    category: 'state',
    description: 'A task or turn finished successfully and is now settling back down.',
    id: 'completed',
    label: 'Completed',
    source: 'synthetic',
  },
  {
    category: 'state',
    description: 'Claude hit a terminal or hook-level error condition.',
    id: 'error',
    label: 'Error',
    source: 'assistant-hook',
  },
  {
    category: 'state',
    description: 'A tool attempt failed even though the broader session is still alive.',
    id: 'tool_failed',
    label: 'Tool Failed',
    source: 'synthetic',
  },
];

export const EMOTION_PRESETS: ReadonlyArray<VisualEmotionPreset> = [
  {
    category: 'emotion',
    description: 'No extra emotional coloring is being applied.',
    id: 'neutral',
    label: 'Neutral',
  },
  {
    category: 'emotion',
    description: 'A positive completion or upbeat reaction.',
    id: 'happy',
    label: 'Happy',
  },
  {
    category: 'emotion',
    description: 'A blocked, regretful, or otherwise downbeat tone.',
    id: 'sad',
    label: 'Sad',
  },
  {
    category: 'emotion',
    description: 'A sudden alert or unexpected development.',
    id: 'surprised',
    label: 'Surprised',
  },
];

export function isVisualStatePresetId(value: string): boolean {
  return STATE_PRESETS.some((preset) => preset.id === value);
}

export function isVisualEmotionPresetId(value: string): boolean {
  return EMOTION_PRESETS.some((preset) => preset.id === value);
}

/*
 * The current runtime still exposes a single semantic state token. This bridge
 * keeps the existing hook outputs working while preparing the image system for a
 * future two-axis `state + emotion` contract.
 */
export function normalizeAssistantSemanticState(
  state: AssistantSemanticState,
): VisualSelection {
  if (state === 'disconnected') {
    return { state: 'disconnected', emotion: null };
  }

  if (state === 'idle') {
    return { state: 'idle', emotion: null };
  }

  if (state === 'thinking') {
    return { state: 'thinking', emotion: null };
  }

  if (state === 'working') {
    return { state: 'working', emotion: null };
  }

  if (state === 'responding') {
    return { state: 'responding', emotion: null };
  }

  if (state === 'waiting') {
    return { state: 'waiting', emotion: null };
  }

  if (state === 'surprised') {
    return { state: 'waiting', emotion: 'surprised' };
  }

  if (state === 'sad') {
    return { state: 'waiting', emotion: 'sad' };
  }

  if (state === 'happy') {
    return { state: 'completed', emotion: 'happy' };
  }

  return { state: 'error', emotion: null };
}
