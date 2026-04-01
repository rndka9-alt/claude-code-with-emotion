import { AssistantStatusStore } from './assistant-status-store';

describe('AssistantStatusStore', () => {
  it('stores non-expiring updates as the new base snapshot', () => {
    const store = new AssistantStatusStore(1_000);

    store.applyUpdate(
      {
        emotion: 'sad',
        state: 'working',
        line: 'Building pane layout',
        currentTask: 'Resizing panes',
      },
      'test',
    );

    expect(store.getSnapshot().state).toBe('working');
    expect(store.getSnapshot().emotion).toBe('sad');
    expect(store.getSnapshot().currentTask).toBe('Resizing panes');
    expect(store.getSnapshot().activityLabel).toBe('연결 대기 중');
  });

  it('reverts temporary updates back to the base snapshot', async () => {
    const store = new AssistantStatusStore(2_000);

    store.applyUpdate(
      {
        state: 'working',
        line: 'Base state',
        currentTask: 'Normal work',
      },
      'test',
    );

    store.applyUpdate(
      {
        state: 'surprised',
        line: 'Temporary burst',
        durationMs: 20,
      },
      'test',
    );

    expect(store.getSnapshot().state).toBe('surprised');

    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });

    expect(store.getSnapshot().state).toBe('working');
    expect(store.getSnapshot().emotion).toBeNull();
    expect(store.getSnapshot().line).toBe('Base state');
  });

  it('lets a visual overlay emotion sit on top of the semantic base state', () => {
    const store = new AssistantStatusStore(3_000);

    store.applyUpdate(
      {
        state: 'working',
        line: 'Base state',
        currentTask: 'Normal work',
      },
      'assistant-command',
    );
    store.applyVisualOverlay(
      {
        emotion: 'happy',
      },
      'visual-overlay',
    );

    expect(store.getSnapshot().state).toBe('working');
    expect(store.getSnapshot().emotion).toBe('happy');
    expect(store.getSnapshot().source).toBe('visual-overlay');
    expect(store.getSnapshot().overlayLine).toBeNull();

    store.applyVisualOverlay(
      {
        emotion: null,
      },
      'visual-overlay',
    );

    expect(store.getSnapshot().emotion).toBeNull();
    expect(store.getSnapshot().line).toBe('Base state');
  });

  it('lets a visual overlay line sit above the hook-driven activity label', () => {
    const store = new AssistantStatusStore(4_000);

    store.applyUpdate(
      {
        state: 'thinking',
        line: 'Base hook line',
        activityLabel: '자료를 찾는 중',
        currentTask: 'Finding docs',
      },
      'assistant-command',
    );
    store.applyVisualOverlay(
      {
        line: '문제를 좀 더 파볼게요!',
      },
      'visual-overlay',
    );

    expect(store.getSnapshot().line).toBe('문제를 좀 더 파볼게요!');
    expect(store.getSnapshot().overlayLine).toBe('문제를 좀 더 파볼게요!');
    expect(store.getSnapshot().activityLabel).toBe('자료를 찾는 중');

    store.applyVisualOverlay(
      {
        line: null,
      },
      'visual-overlay',
    );

    expect(store.getSnapshot().line).toBe('Base hook line');
    expect(store.getSnapshot().overlayLine).toBeNull();
  });
});
