import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import { formatStatusPanelLine } from './status-panel-line';

const baseSnapshot: AssistantStatusSnapshot = {
  activityLabel: '자료를 찾는 중',
  emotion: null,
  overlayLine: null,
  state: 'thinking',
  line: '질문 읽고 흐름 잡는 중이에요...!',
  currentTask: 'Reading docs',
  updatedAtMs: 1,
  intensity: 'medium',
  source: 'test',
};

describe('formatStatusPanelLine', () => {
  it('renders the hook-driven activity label by itself when no overlay line exists', () => {
    expect(formatStatusPanelLine(baseSnapshot)).toBe('(자료를 찾는 중)');
  });

  it('combines a custom overlay line with the current activity label', () => {
    expect(
      formatStatusPanelLine({
        ...baseSnapshot,
        overlayLine: '문제를 좀 더 파볼게요!',
        line: '문제를 좀 더 파볼게요!',
      }),
    ).toBe('문제를 좀 더 파볼게요! (자료를 찾는 중)');
  });

  it('falls back to the raw line when no activity label exists', () => {
    expect(
      formatStatusPanelLine({
        ...baseSnapshot,
        activityLabel: '',
        overlayLine: null,
      }),
    ).toBe('질문 읽고 흐름 잡는 중이에요...!');
  });

  it('uses a custom state line before the raw hook line', () => {
    expect(
      formatStatusPanelLine(baseSnapshot, {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [
          {
            state: 'thinking',
            line: '상황 파악중...!',
          },
        ],
      }),
    ).toBe('상황 파악중...! (자료를 찾는 중)');
  });
});
