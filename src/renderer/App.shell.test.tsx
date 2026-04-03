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

  it('collapses and re-expands the assistant status panel from its handle', () => {
    render(<App />);

    const handle = screen.getByRole('button', {
      name: 'Collapse assistant status panel',
    });
    const statusPanel = document.getElementById('assistant-status-panel');

    expect(handle).toHaveAttribute('aria-expanded', 'true');
    expect(statusPanel).not.toHaveAttribute('hidden');

    fireEvent.click(handle);

    expect(
      screen.getByRole('button', {
        name: 'Expand assistant status panel',
      }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(statusPanel).toHaveAttribute('hidden');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand assistant status panel',
      }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Collapse assistant status panel',
      }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(statusPanel).not.toHaveAttribute('hidden');
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

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    fireEvent.click(screen.getByRole('tab', { name: '테마' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'App theme' }), {
      target: { value: 'gruvbox-light' },
    });

    await waitFor(() => {
      expect(saveThemeSelection).toHaveBeenCalledWith({
        themeId: 'gruvbox-light',
      });
    });
  });
});
