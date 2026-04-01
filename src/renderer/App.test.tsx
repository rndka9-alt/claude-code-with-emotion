import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultAssistantStatusSnapshot } from '../shared/assistant-status';
import { App } from './App';

describe('App', () => {
  it('renders the tab shell and status panel', () => {
    render(<App />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Assistant status panel'),
    ).toBeInTheDocument();
  });

  it('creates a new session tab and switches focus to it', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(
      screen.getByRole('tab', {
        name: 'new session 3 · claude-code-with-emotion',
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', {
        name: 'new session 3 · claude-code-with-emotion',
      }),
    ).toHaveAttribute('title', 'new session 3 · claude-code-with-emotion');
  });

  it('closes a tab from the tab strip close button', () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close claude-code-with-emotion · main workspace',
      }),
    );

    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(
      screen.getByRole('tab', {
        name: 'terminal-resize prototype · claude-code-with-emotion',
      }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('renders only the active terminal session inside the workspace', () => {
    render(<App />);

    expect(
      screen.getByRole('tabpanel', {
        name: 'Active terminal workspace',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal pane stack')).toBeInTheDocument();
    expect(
      screen.getByRole('article', {
        name: 'claude-code-with-emotion · main workspace',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('article', {
        name: 'terminal-resize prototype · claude-code-with-emotion',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('runs claude in the active tab when disconnected launch button is clicked', async () => {
    const sendInput = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, 'claudeApp', {
      configurable: true,
      value: {
        appVersion: 'test',
        assistantStatus: {
          getSnapshot: vi
            .fn()
            .mockResolvedValue(createDefaultAssistantStatusSnapshot(Date.now())),
          onSnapshot: vi.fn(() => () => {}),
        },
        diagnostics: {
          onRuntimeEvent: vi.fn(() => () => {}),
        },
        terminals: {
          bootstrapSession: vi.fn().mockResolvedValue({ initialOutput: '' }),
          sendInput,
          resizeSession: vi.fn(),
          closeSession: vi.fn(),
          onOutput: vi.fn(() => () => {}),
          onExit: vi.fn(() => () => {}),
        },
        visualAssets: {
          getAvailableOptions: vi.fn().mockResolvedValue({
            states: [],
            emotions: [],
          }),
          getCatalog: vi.fn().mockResolvedValue({ version: 1, assets: [], mappings: [] }),
          onCatalog: vi.fn(() => () => {}),
          pickFiles: vi.fn().mockResolvedValue([]),
          saveCatalog: vi.fn(),
          printAvailableOptions: vi.fn(),
        },
      },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '실행하기' }));

    expect(sendInput).toHaveBeenCalledWith({
      sessionId: 'session-1',
      data: 'claude\r',
    });
  });
});
