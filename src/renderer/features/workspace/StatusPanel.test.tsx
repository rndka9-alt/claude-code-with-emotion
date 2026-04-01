import { render, screen } from '@testing-library/react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import { StatusPanel } from './StatusPanel';
import type { StatusPanelVisual } from './status-panel-visual';

const assistantStatus: AssistantStatusSnapshot = {
  activityLabel: '자료를 찾는 중',
  emotion: null,
  overlayLine: null,
  state: 'thinking',
  line: '생각 중이에요...',
  currentTask: 'Testing',
  updatedAtMs: 1,
  intensity: 'medium',
  source: 'test',
};

describe('StatusPanel', () => {
  it('renders a mapped visual asset when one exists', () => {
    const statusVisual: StatusPanelVisual = {
      assetUrl: 'file:///tmp/thinking.png',
      resolution: {
        asset: {
          id: 'asset-thinking',
          kind: 'image',
          label: 'Thinking Fox',
          path: '/tmp/thinking.png',
        },
        mapping: {
          assetId: 'asset-thinking',
          state: 'thinking',
        },
        match: 'state',
      },
    };

    render(
      <StatusPanel
        assistantStatus={assistantStatus}
        onLaunchClaude={() => {}}
        onOpenAssetManager={() => {}}
        statusVisual={statusVisual}
      />,
    );

    expect(screen.getByRole('img', { name: 'Thinking Fox' })).toHaveAttribute(
      'src',
      'file:///tmp/thinking.png',
    );
  });

  it('falls back to the placeholder orb when no asset is mapped', () => {
    const { container } = render(
      <StatusPanel
        assistantStatus={assistantStatus}
        onLaunchClaude={() => {}}
        onOpenAssetManager={() => {}}
        statusVisual={null}
      />,
    );

    expect(container.querySelector('.status-panel__avatar-orb')).not.toBeNull();
  });

  it('renders a custom line with the current activity label in parentheses', () => {
    render(
      <StatusPanel
        assistantStatus={{
          ...assistantStatus,
          overlayLine: '문제를 좀 더 파볼게요!',
          line: '문제를 좀 더 파볼게요!',
        }}
        onLaunchClaude={() => {}}
        onOpenAssetManager={() => {}}
        statusVisual={null}
      />,
    );

    expect(
      screen.getByText('문제를 좀 더 파볼게요! (자료를 찾는 중)'),
    ).toBeInTheDocument();
  });

  it('shows a launch button while disconnected', () => {
    render(
      <StatusPanel
        assistantStatus={{
          ...assistantStatus,
          state: 'disconnected',
        }}
        onLaunchClaude={() => {}}
        onOpenAssetManager={() => {}}
        statusVisual={null}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: '실행하기',
      }),
    ).toBeInTheDocument();
  });
});
