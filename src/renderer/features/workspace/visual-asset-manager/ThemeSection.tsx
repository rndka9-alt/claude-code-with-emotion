import type { ReactElement } from "react";
import {
  APP_THEME_PRESETS,
  isAppThemeId,
  type AppThemeId,
  type AppThemeOption,
} from "../../../../shared/theme";
import { managerSectionCopyClassName } from "./shared";

interface ThemeSectionProps {
  availableThemes: AppThemeOption[];
  currentThemeId: AppThemeId;
  onSelectTheme: (themeId: AppThemeId) => void;
}

export function ThemeSection({
  availableThemes,
  currentThemeId,
  onSelectTheme,
}: ThemeSectionProps): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="m-0">Theme Preset</h3>
        <p className={managerSectionCopyClassName}>
          앱 프레임이랑 터미널 톤을 같이 바꿔요.
        </p>
      </div>

      <label className="flex max-w-[340px] flex-col gap-2 text-sm text-text-secondary">
        <span>테마 선택</span>
        <select
          aria-label="App theme"
          className="min-w-0 border border-border-soft bg-surface-elevated px-3 py-2.5 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-border-strong"
          onChange={(event) => {
            const nextThemeId = event.currentTarget.value;

            if (isAppThemeId(nextThemeId)) {
              onSelectTheme(nextThemeId);
            }
          }}
          value={currentThemeId}
        >
          {availableThemes.map((themeOption) => {
            return (
              <option key={themeOption.id} value={themeOption.id}>
                {themeOption.label}
              </option>
            );
          })}
        </select>
      </label>

      <div className="border border-border-soft bg-surface-elevated px-4 py-3 text-sm leading-6 text-text-secondary">
        {APP_THEME_PRESETS[currentThemeId].description}
      </div>
    </section>
  );
}
