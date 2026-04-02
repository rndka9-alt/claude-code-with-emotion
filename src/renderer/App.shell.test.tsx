import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the tab shell and status panel', () => {
    render(<App />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Assistant status panel'),
    ).toBeInTheDocument();
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
        name: 'new session 1 · claude-code-with-emotion',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('article', {
        name: 'new session 2 · claude-code-with-emotion',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('runs claude in the active tab when disconnected launch button is clicked', async () => {
    const sendInput = vi.fn().mockResolvedValue(undefined);
    const { installDisconnectedClaudeApp } = await import(
      './test-support/app-test-helpers'
    );

    installDisconnectedClaudeApp(sendInput);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '실행하기' }));

    expect(sendInput).toHaveBeenCalledWith({
      sessionId: 'session-1',
      data: '\u0015claude\r',
    });
  });

  it('persists the selected app theme preset', async () => {
    const { installDisconnectedClaudeApp } = await import(
      './test-support/app-test-helpers'
    );
    const { saveThemeSelection } = installDisconnectedClaudeApp();

    render(<App />);

    fireEvent.change(await screen.findByRole('combobox', { name: 'App theme' }), {
      target: { value: 'gruvbox-light' },
    });

    await waitFor(() => {
      expect(saveThemeSelection).toHaveBeenCalledWith({
        themeId: 'gruvbox-light',
      });
    });
  });
});
