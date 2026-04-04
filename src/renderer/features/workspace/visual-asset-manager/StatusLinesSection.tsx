import {
  useEffect,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { CircleHelp } from 'lucide-react';
import type { VisualAssetCatalog } from '../../../../shared/visual-assets';
import {
  getDefaultVisualStateLine,
  STATE_PRESETS,
  type VisualStatePresetId,
} from '../../../../shared/visual-presets';
import {
  managerIconClassName,
  managerInputClassName,
  managerSectionCopyClassName,
} from './shared';

interface StatusLinesSectionProps {
  catalog: VisualAssetCatalog;
  onSetStateLine: (state: VisualStatePresetId, line: string) => void;
}

function createStateLineDrafts(
  catalog: VisualAssetCatalog,
): Record<VisualStatePresetId, string> {
  const drafts: Record<VisualStatePresetId, string> = {
    disconnected: '',
    idle: '',
    thinking: '',
    working: '',
    responding: '',
    waiting: '',
    permission_wait: '',
    interrupted: '',
    completed: '',
    error: '',
    tool_failed: '',
  };

  for (const preset of STATE_PRESETS) {
    drafts[preset.id] =
      catalog.stateLines.find((mapping) => mapping.state === preset.id)?.line ?? '';
  }

  return drafts;
}

function getSituationMessageDescription(state: VisualStatePresetId): string {
  if (state === 'disconnected') {
    return 'Claude 세션이 아직 연결되지 않은 상태예요.';
  }

  if (state === 'idle') {
    return '연결은 되어 있지만, 눈에 띄는 작업은 없는 쉬는 구간이에요.';
  }

  if (state === 'thinking') {
    return '질문을 읽거나 다음 행동을 정리하면서 흐름을 잡는 상태예요.';
  }

  if (state === 'working') {
    return '툴을 쓰거나 파일을 수정하면서 실제 작업을 진행 중인 상태예요.';
  }

  if (state === 'responding') {
    return '쭈인님에게 답변을 작성하거나 스트리밍해서 보내는 상태예요.';
  }

  if (state === 'waiting') {
    return '작업이 잠시 멈춰 있고 다음 입력이나 이벤트를 기다리는 상태예요.';
  }

  if (state === 'permission_wait') {
    return '권한 허용이 필요해서 다음 툴 작업으로 못 넘어가고 멈춘 상태예요.';
  }

  if (state === 'interrupted') {
    return '현재 턴 작업이 중간에 끊긴 상태예요.';
  }

  if (state === 'completed') {
    return '작업이 끝나고 마무리된 상태예요.';
  }

  if (state === 'tool_failed') {
    return '세션은 살아 있지만 특정 툴 시도가 실패한 상태예요.';
  }

  return '오류가 발생해서 정상 흐름에서 벗어난 상태예요.';
}

export function StatusLinesSection({
  catalog,
  onSetStateLine,
}: StatusLinesSectionProps): ReactElement {
  const [stateLineDrafts, setStateLineDrafts] = useState<
    Record<VisualStatePresetId, string>
  >(() => createStateLineDrafts(catalog));

  useEffect(() => {
    setStateLineDrafts(createStateLineDrafts(catalog));
  }, [catalog]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0">Status Text</h3>
      <p className={managerSectionCopyClassName}>
        상태별 기본 한 줄을 덮어써요. Claude가 직접 띄운 overlay 문구는 여전히 먼저 보여요.
      </p>
      <div className="grid gap-3 min-[901px]:grid-cols-2">
        {STATE_PRESETS.map((preset) => {
          const inputId = `state-line-${preset.id}`;

          return (
            <div className="flex flex-col gap-1.5" key={preset.id}>
              <div className="flex items-center gap-1.5">
                <label
                  className="text-xs font-semibold text-text-secondary"
                  htmlFor={inputId}
                >
                  {preset.label}
                </label>
                <span className="group relative inline-flex items-center">
                  <button
                    aria-label={`${preset.label} 상태 설명 보기`}
                    className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-text-accent"
                    type="button"
                  >
                    <CircleHelp
                      aria-hidden="true"
                      className={managerIconClassName}
                    />
                  </button>
                  <span
                    className="pointer-events-none absolute top-full left-1/2 z-[1] mt-2 block w-[220px] -translate-x-1/2 -translate-y-1 border border-tab-border bg-surface-tooltip px-3 py-2.5 text-xs leading-[1.45] text-text-tooltip opacity-0 shadow-tooltip transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    role="tooltip"
                  >
                    {getSituationMessageDescription(preset.id)}
                  </span>
                </span>
              </div>
              <input
                className={managerInputClassName}
                id={inputId}
                onBlur={() => {
                  onSetStateLine(preset.id, stateLineDrafts[preset.id]);
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextLine = event.currentTarget.value;

                  setStateLineDrafts((current) => {
                    return {
                      ...current,
                      [preset.id]: nextLine,
                    };
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                placeholder={getDefaultVisualStateLine(preset.id)}
                type="text"
                value={stateLineDrafts[preset.id]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
