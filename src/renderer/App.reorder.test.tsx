import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App tab reordering', () => {
  it('reorders tabs via drag and drop in the tab strip', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));

    const firstTab = screen.getByRole('tab', {
      name: 'new session 1 · claude-code-with-emotion',
    });
    const secondTab = screen.getByRole('tab', {
      name: 'new session 3 · claude-code-with-emotion',
    });

    fireEvent.dragStart(secondTab.parentElement as HTMLElement);
    fireEvent.dragOver(firstTab.parentElement as HTMLElement);
    fireEvent.drop(firstTab.parentElement as HTMLElement);
    fireEvent.dragEnd(secondTab.parentElement as HTMLElement);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAccessibleName(
      'new session 3 · claude-code-with-emotion',
    );
  });
});
