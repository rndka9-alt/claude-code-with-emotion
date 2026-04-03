import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  getDefaultVisualStateLine,
  normalizeAssistantVisualSelection,
  normalizeAssistantSemanticState,
} from './visual-presets';

describe('visual presets', () => {
  it('keeps hook-facing state presets available in the shared catalog', () => {
    expect(STATE_PRESETS.some((preset) => preset.id === 'thinking')).toBe(true);
    expect(
      STATE_PRESETS.some((preset) => preset.id === 'permission_wait'),
    ).toBe(true);
    expect(EMOTION_PRESETS.some((preset) => preset.id === 'happy')).toBe(true);
    expect(getDefaultVisualStateLine('thinking')).toBe(
      '질문 읽고 흐름 잡는 중이에요...!',
    );
  });

  it('normalizes working states without adding an emotion', () => {
    expect(normalizeAssistantSemanticState('working')).toEqual({
      state: 'working',
      emotion: null,
    });
  });

  it('normalizes emotional semantic states into the future two-axis contract', () => {
    expect(normalizeAssistantSemanticState('happy')).toEqual({
      state: 'completed',
      emotion: 'happy',
    });
    expect(normalizeAssistantSemanticState('sad')).toEqual({
      state: 'waiting',
      emotion: 'sad',
    });
    expect(normalizeAssistantSemanticState('surprised')).toEqual({
      state: 'waiting',
      emotion: 'surprised',
    });
  });

  it('lets explicit assistant emotions override the legacy semantic fallback', () => {
    expect(
      normalizeAssistantVisualSelection({
        state: 'working',
        emotion: 'sad',
      }),
    ).toEqual({
      state: 'working',
      emotion: 'sad',
    });
  });
});
