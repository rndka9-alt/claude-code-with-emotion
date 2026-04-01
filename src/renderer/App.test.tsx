import { fireEvent, render, screen } from '@testing-library/react';
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
});
