import type { AppThemeSelection } from "./theme";

export interface AppThemeBridge {
  getSelection: () => Promise<AppThemeSelection>;
  onSelection: (listener: (selection: AppThemeSelection) => void) => () => void;
  saveSelection: (selection: AppThemeSelection) => Promise<AppThemeSelection>;
}

export const APP_THEME_CHANNELS: {
  getSelection: string;
  saveSelection: string;
  selection: string;
} = {
  getSelection: "app-theme:get-selection",
  saveSelection: "app-theme:save-selection",
  selection: "app-theme:selection",
};
