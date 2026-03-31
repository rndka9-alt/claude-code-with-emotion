import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the bootstrap shell and status panel', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Claude Code Session' }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Assistant status panel'),
    ).toBeInTheDocument();
  });
});
