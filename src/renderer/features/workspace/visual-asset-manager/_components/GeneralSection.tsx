import type { ReactElement } from "react";
import { Wrench } from "lucide-react";
import type {
  VisualMcpSetupOverview,
  VisualMcpSetupTargetId,
  VisualMcpSetupTargetStatus,
} from "../../../../../shared/mcp-setup-bridge";
import { managerSectionCopyClassName } from "../_utils";

interface GeneralSectionProps {
  installingVisualMcpTargetId: VisualMcpSetupTargetId | null;
  mcpSetupErrorsByTargetId: Partial<Record<VisualMcpSetupTargetId, string>>;
  mcpSetupStatus: VisualMcpSetupOverview | null;
  onInstallVisualMcp: (targetId?: VisualMcpSetupTargetId) => void;
}

interface VisualMcpTargetCardProps {
  error: string | null;
  isInstalling: boolean;
  onInstall: (targetId: VisualMcpSetupTargetId) => void;
  status: VisualMcpSetupTargetStatus;
}

function formatBuildFingerprint(): string {
  const date = new Date(__BUILD_TIMESTAMP__);
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yy}${mm}${dd}.${hh}${mi}-${__BUILD_COMMIT__}`;
}

function createPendingTargetStatus(
  targetId: VisualMcpSetupTargetId,
  displayName: string,
): VisualMcpSetupTargetStatus {
  return {
    displayName,
    installed: false,
    stateFilePath: "",
    targetId,
  };
}

function VisualMcpTargetCard({
  error,
  isInstalling,
  onInstall,
  status,
}: VisualMcpTargetCardProps): ReactElement {
  const description =
    status.targetId === "claude"
      ? "기본 Claude Code 연동이에요. 상태창 프롬프트와 비주얼 도구가 여기 붙어요."
      : "터미널에서 codex를 직접 실행할 때 쓰는 확장 연동이에요.";

  return (
    <div className="border-border-soft bg-surface-elevated flex flex-col gap-3 border px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-text-primary m-0 text-sm font-semibold">
            {status.displayName}
          </h4>
          <p className="text-text-secondary m-0 mt-1 text-sm leading-6">
            {description}
          </p>
        </div>
        <span className="border-border-soft text-text-subtle shrink-0 border px-2 py-1 text-xs">
          {status.installed ? "설치됨" : "미설치"}
        </span>
      </div>

      {status.installed ? (
        <p className="text-text-secondary m-0 text-sm leading-6">
          Visual MCP가 설치대어 잇어요. 이쪽은 평화롭네요...!
        </p>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-start gap-2.5">
            <Wrench
              aria-hidden="true"
              className="text-text-accent mt-0.5 h-4 w-4 shrink-0"
            />
            <p className="text-text-secondary m-0 text-sm leading-6">
              아직 설치 안 된 상태예요. 설치하면 상태창 비주얼 연결이 살아나요.
            </p>
          </div>
          <button
            className="border-border-launch bg-surface-launch text-text-tooltip hover:bg-surface-launch-hover inline-flex h-[34px] items-center justify-center border px-3 text-sm font-semibold tracking-[0.01em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isInstalling}
            onClick={() => {
              onInstall(status.targetId);
            }}
            type="button"
          >
            {isInstalling ? "설치중..." : `${status.displayName} MCP 설치`}
          </button>
        </div>
      )}

      {error !== null ? (
        <p className="m-0 text-sm leading-6 text-[#ffb4b4]">{error}</p>
      ) : null}
    </div>
  );
}

export function GeneralSection({
  installingVisualMcpTargetId,
  mcpSetupErrorsByTargetId,
  mcpSetupStatus,
  onInstallVisualMcp,
}: GeneralSectionProps): ReactElement {
  const claudeStatus =
    mcpSetupStatus?.targets.claude ??
    createPendingTargetStatus("claude", "Claude Code");
  const codexStatus =
    mcpSetupStatus?.targets.codex ??
    createPendingTargetStatus("codex", "Codex CLI");

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="m-0">Visual MCP</h3>
        <p className={managerSectionCopyClassName}>
          상태 오버레이랑 에셋 연동을 쓰려면 CLI별 user-scope MCP 서버 설치가
          필요해요.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <VisualMcpTargetCard
          error={mcpSetupErrorsByTargetId.claude ?? null}
          isInstalling={installingVisualMcpTargetId === "claude"}
          onInstall={onInstallVisualMcp}
          status={claudeStatus}
        />
        <VisualMcpTargetCard
          error={mcpSetupErrorsByTargetId.codex ?? null}
          isInstalling={installingVisualMcpTargetId === "codex"}
          onInstall={onInstallVisualMcp}
          status={codexStatus}
        />
      </div>

      <div className="border-border-soft mt-3 border-t pt-4">
        <p className="text-text-subtle m-0 font-mono text-[11px] tracking-wide select-all">
          build {formatBuildFingerprint()}
        </p>
      </div>
    </section>
  );
}
