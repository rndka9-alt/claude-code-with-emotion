import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { CircleHelp, Image as ImageIcon, Search } from "lucide-react";
import {
  getVisualAssetProviderStateLines,
  resolveVisualAsset,
  type VisualAssetCatalog,
  type VisualAssetProviderId,
  type VisualProviderStateMetadata,
} from "../../../../../shared/visual-assets";
import {
  getDefaultVisualStateLine,
  STATE_PRESETS,
  type VisualStatePresetId,
} from "../../../../../shared/visual-presets";
import { createStatusPanelAssetUrl } from "../../status-panel";
import {
  managerIconClassName,
  managerInputClassName,
  managerSearchIconWrapperClassName,
  managerSearchInputClassName,
  managerSectionCopyClassName,
} from "../_utils";

interface StatusLinesSectionProps {
  catalog: VisualAssetCatalog;
  onSetStateLine: (state: VisualStatePresetId, line: string) => void;
  providerId: VisualAssetProviderId;
  stateMetadata: ReadonlyArray<VisualProviderStateMetadata>;
}

function createStateLineDrafts(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId,
): Record<VisualStatePresetId, string> {
  const drafts: Record<VisualStatePresetId, string> = {
    disconnected: "",
    thinking: "",
    working: "",
    waiting: "",
    permission_wait: "",
    compacting: "",
    completed: "",
    error: "",
    tool_failed: "",
  };

  for (const mapping of getVisualAssetProviderStateLines(catalog, providerId)) {
    drafts[mapping.state] = mapping.line;
  }

  return drafts;
}

function formatStateMetadataTooltip(
  metadata: VisualProviderStateMetadata,
): string {
  if (metadata.eventNames.length === 0) {
    return metadata.description;
  }

  return `${metadata.description}\n\n실제 이벤트: ${metadata.eventNames.join(", ")}`;
}

function getStateLabel(state: VisualStatePresetId): string {
  return STATE_PRESETS.find((preset) => preset.id === state)?.label ?? state;
}

export function StatusLinesSection({
  catalog,
  onSetStateLine,
  providerId,
  stateMetadata,
}: StatusLinesSectionProps): ReactElement {
  const [stateLineDrafts, setStateLineDrafts] = useState<
    Record<VisualStatePresetId, string>
  >(() => createStateLineDrafts(catalog, providerId));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setStateLineDrafts(createStateLineDrafts(catalog, providerId));
  }, [catalog, providerId]);

  const stateAssetUrls = useMemo(() => {
    const urls = new Map<VisualStatePresetId, string>();

    for (const metadata of stateMetadata) {
      const resolution = resolveVisualAsset(catalog, {
        emotion: null,
        providerId,
        state: metadata.state,
      });

      if (resolution !== null) {
        urls.set(metadata.state, createStatusPanelAssetUrl(resolution.asset.path));
      }
    }

    return urls;
  }, [catalog, providerId, stateMetadata]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredMetadata = useMemo(() => {
    if (normalizedSearchQuery.length === 0) {
      return stateMetadata;
    }

    return stateMetadata.filter((metadata) => {
      return (
        metadata.state.toLowerCase().includes(normalizedSearchQuery) ||
        getStateLabel(metadata.state)
          .toLowerCase()
          .includes(normalizedSearchQuery) ||
        metadata.description.toLowerCase().includes(normalizedSearchQuery) ||
        metadata.eventNames.some((eventName) => {
          return eventName.toLowerCase().includes(normalizedSearchQuery);
        })
      );
    });
  }, [normalizedSearchQuery, stateMetadata]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0">Status Text</h3>
      <p className={managerSectionCopyClassName}>
        상태별 기본 한 줄을 덮어써요. Provider마다 실제로 들어오는 상태만
        편집해요.
      </p>
      <div className="relative">
        <span className={managerSearchIconWrapperClassName}>
          <Search aria-hidden="true" className={managerIconClassName} />
        </span>
        <input
          aria-label="상태 설명 검색"
          className={managerSearchInputClassName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(event.currentTarget.value);
          }}
          placeholder="상태, 설명 또는 실제 이벤트로 검색"
          type="search"
          value={searchQuery}
        />
      </div>
      {filteredMetadata.length === 0 ? (
        <div className="border-border-muted bg-surface-empty text-text-faint border border-dashed p-7">
          검색어에 걸리는 상태가 읍어요...!
        </div>
      ) : null}
      <div className="grid gap-3 min-[901px]:grid-cols-2">
        {filteredMetadata.map((metadata) => {
          const inputId = `state-line-${providerId}-${metadata.state}`;
          const assetUrl = stateAssetUrls.get(metadata.state) ?? null;
          const label = getStateLabel(metadata.state);

          return (
            <div className="flex flex-col gap-1.5" key={metadata.state}>
              <div className="flex items-center gap-1.5">
                <label
                  className="text-text-secondary text-xs font-semibold"
                  htmlFor={inputId}
                >
                  {label}
                </label>
                <span className="group relative inline-flex items-center">
                  <button
                    aria-label={`${label} 상태 설명 보기`}
                    className="text-text-accent inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent"
                    type="button"
                  >
                    <CircleHelp
                      aria-hidden="true"
                      className={managerIconClassName}
                    />
                  </button>
                  <span
                    className="border-tab-border bg-surface-tooltip text-text-tooltip shadow-tooltip pointer-events-none absolute top-full left-0 z-[1] mt-2 block w-[240px] -translate-y-1 whitespace-pre-line border px-3 py-2.5 text-xs leading-[1.45] opacity-0 transition-[opacity,transform] duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
                    role="tooltip"
                  >
                    {formatStateMetadataTooltip(metadata)}
                  </span>
                </span>
                {assetUrl !== null ? (
                  <span className="group relative inline-flex items-center">
                    <button
                      aria-label={`${label} 매핑 이미지 미리보기`}
                      className="text-text-accent inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent"
                      type="button"
                    >
                      <ImageIcon
                        aria-hidden="true"
                        className={managerIconClassName}
                      />
                    </button>
                    <span
                      className="border-tab-border bg-surface-tooltip shadow-tooltip pointer-events-none absolute top-full left-0 z-[1] mt-2 block w-32 -translate-y-1 border opacity-0 transition-[opacity,transform] duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
                      role="tooltip"
                    >
                      <img
                        alt=""
                        className="block aspect-square w-full object-cover"
                        src={assetUrl}
                      />
                    </span>
                  </span>
                ) : null}
              </div>
              <input
                className={managerInputClassName}
                id={inputId}
                onBlur={() => {
                  onSetStateLine(
                    metadata.state,
                    stateLineDrafts[metadata.state],
                  );
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextLine = event.currentTarget.value;

                  setStateLineDrafts((current) => {
                    return {
                      ...current,
                      [metadata.state]: nextLine,
                    };
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                placeholder={getDefaultVisualStateLine(metadata.state)}
                type="text"
                value={stateLineDrafts[metadata.state]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
