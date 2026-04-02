import { fireEvent, render, screen } from '@testing-library/react';
import { VisualAssetManagerDialog } from './VisualAssetManagerDialog';

describe('VisualAssetManagerDialog', () => {
  it('switches between asset and message tabs', () => {
    render(
      <VisualAssetManagerDialog
        catalog={{
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
        }}
        onClose={() => {}}
        onPickFiles={() => {}}
        onRemoveAsset={() => {}}
        onSetDefaultAsset={() => {}}
        onSetStateLine={() => {}}
        onToggleEmotion={() => {}}
        onToggleState={() => {}}
        onToggleStateEmotion={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Add Images' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '상태 메시지' }));

    expect(
      screen.queryByRole('button', { name: 'Add Images' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disconnected 상태 설명 보기' }),
    ).toBeInTheDocument();
  });
});
