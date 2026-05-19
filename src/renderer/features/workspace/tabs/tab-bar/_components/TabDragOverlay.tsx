import type { CSSProperties, ReactElement } from "react";
import { X } from "lucide-react";
import type { WorkspaceTab } from "../../../model";

interface TabDragOverlayProps {
  activeTabId: string;
  hasNotification: boolean;
  tab: WorkspaceTab;
}

type TabToneStyle = CSSProperties & {
  "--tab-background": string;
  "--tab-border": string;
  "--tab-foreground": string;
};

export function TabDragOverlay({
  activeTabId,
  hasNotification,
  tab,
}: TabDragOverlayProps): ReactElement {
  const isActive = tab.id === activeTabId;
  const tabToneStyle: TabToneStyle = {
    "--tab-background": isActive
      ? "var(--color-tab-background-active)"
      : "var(--color-tab-background)",
    "--tab-border": isActive
      ? "var(--color-tab-border-active)"
      : "var(--color-tab-border)",
    "--tab-foreground": isActive
      ? "var(--color-tab-foreground-active)"
      : "var(--color-tab-foreground)",
  };

  return (
    <div
      className="group shadow-tab-drag relative flex max-w-60 min-w-40 flex-none items-stretch opacity-[0.92]"
      role="presentation"
    >
      <div
        className="relative flex w-full min-w-0 flex-1 border border-b-0 border-[var(--tab-border)] bg-[var(--tab-background)] px-[14px] py-1.5 text-left text-[0.88rem] text-[var(--tab-foreground)] select-none"
        style={tabToneStyle}
      >
        <span className="block overflow-hidden leading-[1.2] text-ellipsis whitespace-nowrap">
          {tab.title}
        </span>
      </div>

      {hasNotification ? (
        <div
          className="absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] shadow-[-10px_0_10px_var(--tab-background)]"
          style={tabToneStyle}
        >
          <span className="bg-tab-notification absolute h-[7px] w-[7px] rounded-full" />
        </div>
      ) : (
        <div
          className="text-tab-close-foreground absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] opacity-100 shadow-[-10px_0_10px_var(--tab-background)]"
          style={tabToneStyle}
        >
          <X
            aria-hidden="true"
            className="h-[11px] w-[11px]"
            strokeWidth={2.25}
          />
        </div>
      )}
    </div>
  );
}
