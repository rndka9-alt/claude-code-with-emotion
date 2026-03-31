import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the tab shell and status panel', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: 'claude-code-with-emotion · main workspace',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Assistant status panel'),
    ).toBeInTheDocument();
  });

  it('creates a new session tab and switches focus to it', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));

    expect(
      screen.getByRole('heading', {
        name: 'new session 3 · claude-code-with-emotion',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('renders vertically stacked terminal panes for each session', () => {
    render(<App />);

    expect(screen.getByLabelText('Terminal pane stack')).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/claude-code-with-emotion/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});
