import { useEffect, useMemo, useState } from "react";
import {
  APP_THEME_OPTIONS,
  APP_THEME_VARIABLE_NAMES,
  createDefaultAppThemeSelection,
  getAppThemeDefinition,
  type AppThemeId,
  type AppThemeOption,
  type AppThemeSelection,
} from "../../../shared/theme";
import { syncAllTerminalThemes } from "./terminal";

export interface AppThemeViewModel {
  currentThemeId: AppThemeId;
  themeOptions: AppThemeOption[];
  setThemeId: (themeId: AppThemeId) => void;
}

function applyThemeSelection(selection: AppThemeSelection): void {
  const root = document.documentElement;
  const themeDefinition = getAppThemeDefinition(selection.themeId);

  root.style.colorScheme = themeDefinition.colorScheme;

  for (const variableName of APP_THEME_VARIABLE_NAMES) {
    root.style.setProperty(variableName, themeDefinition.colors[variableName]);
  }

  syncAllTerminalThemes();
}

export function useAppTheme(): AppThemeViewModel {
  const bridge = window.claudeApp?.appTheme;
  const [selection, setSelection] = useState<AppThemeSelection>(
    createDefaultAppThemeSelection(),
  );
  const themeOptions = useMemo(() => APP_THEME_OPTIONS, []);

  useEffect(() => {
    if (bridge === undefined) {
      return;
    }

    let isDisposed = false;

    void bridge.getSelection().then((nextSelection) => {
      if (!isDisposed) {
        setSelection(nextSelection);
      }
    });

    const unsubscribe = bridge.onSelection((nextSelection) => {
      setSelection(nextSelection);
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [bridge]);

  useEffect(() => {
    applyThemeSelection(selection);
  }, [selection]);

  return {
    currentThemeId: selection.themeId,
    themeOptions,
    setThemeId: (themeId) => {
      const nextSelection = { themeId };

      setSelection(nextSelection);

      if (bridge !== undefined) {
        void bridge.saveSelection(nextSelection).then((savedSelection) => {
          setSelection(savedSelection);
        });
      }
    },
  };
}
