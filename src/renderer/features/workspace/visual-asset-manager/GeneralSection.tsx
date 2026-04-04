import type { ReactElement } from 'react';
import { Wrench } from 'lucide-react';
import { managerSectionCopyClassName } from './shared';

interface GeneralSectionProps {
  isInstallingVisualMcp: boolean;
  mcpSetupError: string | null;
  mcpSetupInstalled: boolean;
  onInstallVisualMcp: () => void;
}

export function GeneralSection({
  isInstallingVisualMcp,
  mcpSetupError,
  mcpSetupInstalled,
  onInstallVisualMcp,
}: GeneralSectionProps): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="m-0">Visual MCP</h3>
        <p className={managerSectionCopyClassName}>
          상태 오버레이랑 에셋 연동을 쓰려면 user-scope MCP 서버 설치가 필요해요.
        </p>
      </div>

      {mcpSetupInstalled ? (
        <div className="border border-border-soft bg-surface-elevated px-4 py-3 text-sm text-text-secondary">
          Visual MCP가 이미 설치대어 잇어요. 이쪽은 평화롭네요...!
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 border border-border-soft bg-surface-elevated px-4 py-4">
          <div className="flex items-start gap-2.5">
            <Wrench
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-text-accent"
            />
            <p className="m-0 text-sm leading-6 text-text-secondary">
              아직 설치 안 된 상태예요. 여기서 바로 설치하면 상태창 비주얼
              연결이 살아나요.
            </p>
          </div>
          <button
            className="inline-flex h-[34px] items-center justify-center border border-border-launch bg-surface-launch px-3 text-sm font-semibold tracking-[0.01em] text-text-tooltip transition-colors duration-150 hover:bg-surface-launch-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isInstallingVisualMcp}
            onClick={onInstallVisualMcp}
            type="button"
          >
            {isInstallingVisualMcp ? '설치중...' : 'Visual MCP 설치'}
          </button>
          {mcpSetupError !== null ? (
            <p className="m-0 text-sm leading-6 text-[#ffb4b4]">
              {mcpSetupError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
