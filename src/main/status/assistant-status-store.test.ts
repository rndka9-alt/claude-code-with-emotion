import { AssistantStatusStore } from './assistant-status-store';

describe('AssistantStatusStore', () => {
  it('stores non-expiring updates as the new base snapshot', () => {
    const store = new AssistantStatusStore(1_000);

    store.applyUpdate(
      {
        state: 'working',
        line: 'Building pane layout',
        currentTask: 'Resizing panes',
      },
      'test',
    );

    expect(store.getSnapshot().state).toBe('working');
    expect(store.getSnapshot().currentTask).toBe('Resizing panes');
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
    expect(store.getSnapshot().line).toBe('Base state');
  });
});
