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

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(
      screen.getByRole('tab', {
        name: 'new session 2 · claude-code-with-emotion',
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', {
        name: 'new session 2 · claude-code-with-emotion',
      }),
    ).toHaveAttribute('title', 'new session 2 · claude-code-with-emotion');
  });

  it('closes a tab from the tab strip close button', () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close new session 1 · claude-code-with-emotion',
      }),
    );

    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(
      screen.getByRole('tab', {
        name: 'new session 2 · claude-code-with-emotion',
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

  it('reorders tabs via drag and drop in the tab strip', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));

    const firstTab = screen.getByRole('tab', {
      name: 'new session 1 · claude-code-with-emotion',
    });
    const secondTab = screen.getByRole('tab', {
      name: 'new session 2 · claude-code-with-emotion',
    });

    fireEvent.dragStart(secondTab.parentElement as HTMLElement);
    fireEvent.dragOver(firstTab.parentElement as HTMLElement);
    fireEvent.drop(firstTab.parentElement as HTMLElement);
    fireEvent.dragEnd(secondTab.parentElement as HTMLElement);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAccessibleName('new session 2 · claude-code-with-emotion');
  });
});
