const CURRENT_DARK_THEME_COLORS = {
  "--color-app-bg": "#11141a",
  "--color-app-window": "#101218",
  "--color-text-primary": "#f3f7ff",
  "--color-text-strong": "#e9eefc",
  "--color-text-secondary": "#d5def4",
  "--color-text-muted": "#b8c6e5",
  "--color-text-soft": "#b7c4e2",
  "--color-text-faint": "#b3c1df",
  "--color-text-subtle": "#8f9dbd",
  "--color-text-accent": "#92a7d8",
  "--color-text-highlight": "#f4f8ff",
  "--color-text-tooltip": "#eef3ff",
  "--color-text-overlay": "rgba(241, 246, 255, 0.88)",
  "--color-text-inverse": "#ffffff",
  "--color-surface-terminal": "#0b0f17",
  "--color-surface-terminal-theme": "#0b1019",
  "--color-surface-panel": "#10141d",
  "--color-surface-dialog": "#0f1319",
  "--color-surface-elevated": "#171d28",
  "--color-surface-elevated-muted": "#141923",
  "--color-surface-elevated-active": "#1b2331",
  "--color-surface-hover": "#262d39",
  "--color-surface-chip": "#121723",
  "--color-surface-preview": "#0a0d14",
  "--color-surface-tooltip": "#0d121a",
  "--color-surface-empty": "rgba(20, 24, 32, 0.72)",
  "--color-surface-overlay": "rgba(7, 9, 14, 0.72)",
  "--color-surface-frost": "rgba(11, 15, 23, 0.72)",
  "--color-surface-frost-strong": "rgba(28, 35, 49, 0.94)",
  "--color-surface-launch": "rgba(8, 12, 19, 0.82)",
  "--color-surface-launch-hover": "rgba(35, 50, 78, 0.96)",
  "--color-surface-create-hover": "rgba(35, 42, 56, 0.88)",
  "--color-border-subtle": "rgba(121, 137, 175, 0.22)",
  "--color-border-muted": "rgba(121, 137, 175, 0.24)",
  "--color-border-soft": "rgba(121, 137, 175, 0.2)",
  "--color-border-ghost": "rgba(121, 137, 175, 0.14)",
  "--color-border-strong": "rgba(143, 165, 216, 0.48)",
  "--color-border-panel": "rgba(138, 163, 228, 0.16)",
  "--color-border-overlay": "rgba(180, 199, 238, 0.24)",
  "--color-border-create-hover": "rgba(176, 196, 255, 0.3)",
  "--color-border-launch": "rgba(174, 198, 244, 0.4)",
  "--color-tab-background": "#161a22",
  "--color-tab-background-active": "#0f1319",
  "--color-tab-border": "rgba(121, 137, 175, 0.28)",
  "--color-tab-border-active": "rgba(145, 161, 201, 0.42)",
  "--color-tab-foreground": "#9caacf",
  "--color-tab-foreground-active": "#f5f8ff",
  "--color-tab-create-foreground": "#bac7e8",
  "--color-tab-close-foreground": "#d2dcf7",
  "--color-tab-indicator-start": "#d5e3ff",
  "--color-tab-indicator-end": "#8db1ff",
  "--shadow-tab-indicator": "0 0 0 1px rgba(141, 177, 255, 0.22)",
  "--shadow-tab-drag": "0 10px 24px rgba(4, 8, 15, 0.34)",
  "--shadow-dialog": "0 28px 80px rgba(0, 0, 0, 0.44)",
  "--shadow-tooltip": "0 16px 36px rgba(0, 0, 0, 0.32)",
  "--color-avatar-working": "#1a2233",
  "--color-avatar-thinking": "#202638",
  "--color-avatar-idle": "#171d2c",
  "--color-avatar-happy": "#1c2c39",
  "--color-avatar-surprised": "#3d2a17",
  "--color-avatar-sad": "#232838",
  "--color-avatar-error": "#4b1e1e",
  "--color-avatar-image": "#0b0f17",
  "--color-avatar-orb": "#6b8ff7",
  "--shadow-avatar-orb":
    "0 0 20px rgba(118, 159, 255, 0.32), inset 0 -4px 10px rgba(45, 69, 196, 0.26)",
  "--shadow-avatar-orb-strong":
    "0 0 24px rgba(118, 159, 255, 0.38), inset 0 -4px 10px rgba(45, 69, 196, 0.28)",
  "--color-terminal-foreground": "#f4f7ff",
  "--color-terminal-blue": "#6a8aff",
  "--color-terminal-bright-blue": "#92bcff",
  "--color-terminal-green": "#8fe4b6",
};

export type AppThemeVariableName = keyof typeof CURRENT_DARK_THEME_COLORS;
export type AppThemeColors = Record<AppThemeVariableName, string>;
export type AppThemeId =
  | "current-dark"
  | "iterm-beige"
  | "gruvbox-dark"
  | "gruvbox-light";

export interface AppThemeDefinition {
  id: AppThemeId;
  label: string;
  description: string;
  colorScheme: "dark" | "light";
  windowBackground: string;
  colors: AppThemeColors;
}

export interface AppThemeOption {
  id: AppThemeId;
  label: string;
}

export interface AppThemeSelection {
  themeId: AppThemeId;
}

function createThemeColors(
  overrides: Partial<AppThemeColors> = {},
): AppThemeColors {
  return {
    ...CURRENT_DARK_THEME_COLORS,
    ...overrides,
  };
}

export const DEFAULT_APP_THEME_ID: AppThemeId = "current-dark";
export const APP_THEME_VARIABLE_NAMES = Object.keys(
  CURRENT_DARK_THEME_COLORS,
).filter((variableName): variableName is AppThemeVariableName => {
  return Object.hasOwn(CURRENT_DARK_THEME_COLORS, variableName);
});

export const APP_THEME_PRESETS: Record<AppThemeId, AppThemeDefinition> = {
  "current-dark": {
    id: "current-dark",
    label: "Current Dark",
    description: "현재 앱 기본 다크 테마예요.",
    colorScheme: "dark",
    windowBackground: "#101218",
    colors: createThemeColors(),
  },
  "iterm-beige": {
    id: "iterm-beige",
    label: "iTerm Beige",
    description: "따끈한 베이지 톤으로 정리한 터미널 감성 테마예요.",
    colorScheme: "light",
    windowBackground: "#eadfce",
    colors: createThemeColors({
      "--color-app-bg": "#f2e6d8",
      "--color-app-window": "#eadfce",
      "--color-text-primary": "#3d3125",
      "--color-text-strong": "#33291f",
      "--color-text-secondary": "#5a4d40",
      "--color-text-muted": "#76695c",
      "--color-text-soft": "#6f6255",
      "--color-text-faint": "#8a7d6f",
      "--color-text-subtle": "#8e7e6f",
      "--color-text-accent": "#8d6840",
      "--color-text-highlight": "#2b231c",
      "--color-text-tooltip": "#2b241d",
      "--color-text-overlay": "rgba(52, 41, 31, 0.84)",
      "--color-surface-terminal": "#f7efe3",
      "--color-surface-terminal-theme": "#f7efe3",
      "--color-surface-panel": "#eadfce",
      "--color-surface-dialog": "#f3e9db",
      "--color-surface-elevated": "#efe4d4",
      "--color-surface-elevated-muted": "#e6d8c4",
      "--color-surface-elevated-active": "#dbcbb5",
      "--color-surface-hover": "#ddd0bb",
      "--color-surface-chip": "#ece0cf",
      "--color-surface-preview": "#dfd1bc",
      "--color-surface-tooltip": "#fff6ec",
      "--color-surface-empty": "rgba(235, 223, 206, 0.86)",
      "--color-surface-overlay": "rgba(77, 61, 42, 0.32)",
      "--color-surface-frost": "rgba(247, 239, 227, 0.84)",
      "--color-surface-frost-strong": "rgba(255, 248, 239, 0.96)",
      "--color-surface-launch": "rgba(244, 235, 224, 0.92)",
      "--color-surface-launch-hover": "rgba(230, 216, 198, 0.98)",
      "--color-surface-create-hover": "rgba(226, 214, 197, 0.9)",
      "--color-border-subtle": "rgba(123, 103, 82, 0.2)",
      "--color-border-muted": "rgba(123, 103, 82, 0.24)",
      "--color-border-soft": "rgba(123, 103, 82, 0.18)",
      "--color-border-ghost": "rgba(123, 103, 82, 0.12)",
      "--color-border-strong": "rgba(141, 104, 64, 0.44)",
      "--color-border-panel": "rgba(123, 103, 82, 0.18)",
      "--color-border-overlay": "rgba(123, 103, 82, 0.22)",
      "--color-border-create-hover": "rgba(141, 104, 64, 0.3)",
      "--color-border-launch": "rgba(141, 104, 64, 0.34)",
      "--color-tab-background": "#e9ddcb",
      "--color-tab-background-active": "#f6ecdf",
      "--color-tab-border": "rgba(123, 103, 82, 0.24)",
      "--color-tab-border-active": "rgba(141, 104, 64, 0.36)",
      "--color-tab-foreground": "#6f6255",
      "--color-tab-foreground-active": "#2b231c",
      "--color-tab-create-foreground": "#7f705f",
      "--color-tab-close-foreground": "#6b5d4f",
      "--color-tab-indicator-start": "#f0c48a",
      "--color-tab-indicator-end": "#b87b3d",
      "--shadow-tab-indicator": "0 0 0 1px rgba(184, 123, 61, 0.22)",
      "--shadow-tab-drag": "0 10px 24px rgba(81, 62, 43, 0.18)",
      "--shadow-dialog": "0 28px 80px rgba(81, 62, 43, 0.24)",
      "--shadow-tooltip": "0 16px 36px rgba(81, 62, 43, 0.2)",
      "--color-avatar-working": "#d8c7b2",
      "--color-avatar-thinking": "#d5c4af",
      "--color-avatar-idle": "#ddd1bf",
      "--color-avatar-happy": "#d5d9bc",
      "--color-avatar-surprised": "#e1c7a5",
      "--color-avatar-sad": "#d2c7cb",
      "--color-avatar-error": "#dfbeb7",
      "--color-avatar-image": "#ece0cf",
      "--color-avatar-orb": "#c18a52",
      "--shadow-avatar-orb":
        "0 0 20px rgba(193, 138, 82, 0.28), inset 0 -4px 10px rgba(140, 95, 48, 0.2)",
      "--shadow-avatar-orb-strong":
        "0 0 24px rgba(193, 138, 82, 0.34), inset 0 -4px 10px rgba(140, 95, 48, 0.24)",
      "--color-terminal-foreground": "#3d3125",
      "--color-terminal-blue": "#4f6ea2",
      "--color-terminal-bright-blue": "#6d86b5",
      "--color-terminal-green": "#678655",
    }),
  },
  "gruvbox-dark": {
    id: "gruvbox-dark",
    label: "Gruvbox Dark",
    description: "gruvbox 다크의 구수한 황토 감성 그대로예요.",
    colorScheme: "dark",
    windowBackground: "#1d2021",
    colors: createThemeColors({
      "--color-app-bg": "#1d2021",
      "--color-app-window": "#1d2021",
      "--color-text-primary": "#ebdbb2",
      "--color-text-strong": "#fbf1c7",
      "--color-text-secondary": "#d5c4a1",
      "--color-text-muted": "#bdae93",
      "--color-text-soft": "#a89984",
      "--color-text-faint": "#928374",
      "--color-text-subtle": "#928374",
      "--color-text-accent": "#83a598",
      "--color-text-highlight": "#fbf1c7",
      "--color-text-tooltip": "#f9f5d7",
      "--color-text-overlay": "rgba(251, 241, 199, 0.88)",
      "--color-surface-terminal": "#1d2021",
      "--color-surface-terminal-theme": "#1d2021",
      "--color-surface-panel": "#282828",
      "--color-surface-dialog": "#282828",
      "--color-surface-elevated": "#32302f",
      "--color-surface-elevated-muted": "#3c3836",
      "--color-surface-elevated-active": "#504945",
      "--color-surface-hover": "#504945",
      "--color-surface-chip": "#3c3836",
      "--color-surface-preview": "#1d2021",
      "--color-surface-tooltip": "#32302f",
      "--color-surface-empty": "rgba(50, 48, 47, 0.88)",
      "--color-surface-overlay": "rgba(29, 32, 33, 0.76)",
      "--color-surface-frost": "rgba(40, 40, 40, 0.8)",
      "--color-surface-frost-strong": "rgba(50, 48, 47, 0.94)",
      "--color-surface-launch": "rgba(50, 48, 47, 0.88)",
      "--color-surface-launch-hover": "rgba(80, 73, 69, 0.98)",
      "--color-surface-create-hover": "rgba(80, 73, 69, 0.9)",
      "--color-border-subtle": "rgba(168, 153, 132, 0.2)",
      "--color-border-muted": "rgba(168, 153, 132, 0.24)",
      "--color-border-soft": "rgba(168, 153, 132, 0.18)",
      "--color-border-ghost": "rgba(168, 153, 132, 0.12)",
      "--color-border-strong": "rgba(250, 189, 47, 0.34)",
      "--color-border-panel": "rgba(168, 153, 132, 0.16)",
      "--color-border-overlay": "rgba(168, 153, 132, 0.2)",
      "--color-border-create-hover": "rgba(250, 189, 47, 0.26)",
      "--color-border-launch": "rgba(250, 189, 47, 0.3)",
      "--color-tab-background": "#32302f",
      "--color-tab-background-active": "#282828",
      "--color-tab-border": "rgba(168, 153, 132, 0.22)",
      "--color-tab-border-active": "rgba(250, 189, 47, 0.34)",
      "--color-tab-foreground": "#bdae93",
      "--color-tab-foreground-active": "#fbf1c7",
      "--color-tab-create-foreground": "#d5c4a1",
      "--color-tab-close-foreground": "#d5c4a1",
      "--color-tab-indicator-start": "#fabd2f",
      "--color-tab-indicator-end": "#fe8019",
      "--shadow-tab-indicator": "0 0 0 1px rgba(250, 189, 47, 0.24)",
      "--shadow-tab-drag": "0 10px 24px rgba(0, 0, 0, 0.3)",
      "--shadow-dialog": "0 28px 80px rgba(0, 0, 0, 0.42)",
      "--shadow-tooltip": "0 16px 36px rgba(0, 0, 0, 0.3)",
      "--color-avatar-working": "#3c3836",
      "--color-avatar-thinking": "#504945",
      "--color-avatar-idle": "#32302f",
      "--color-avatar-happy": "#4a5b3b",
      "--color-avatar-surprised": "#7c5a2a",
      "--color-avatar-sad": "#4c3b4d",
      "--color-avatar-error": "#5d2222",
      "--color-avatar-image": "#1d2021",
      "--color-avatar-orb": "#d79921",
      "--shadow-avatar-orb":
        "0 0 20px rgba(215, 153, 33, 0.28), inset 0 -4px 10px rgba(175, 116, 0, 0.24)",
      "--shadow-avatar-orb-strong":
        "0 0 24px rgba(215, 153, 33, 0.34), inset 0 -4px 10px rgba(175, 116, 0, 0.28)",
      "--color-terminal-foreground": "#ebdbb2",
      "--color-terminal-blue": "#458588",
      "--color-terminal-bright-blue": "#83a598",
      "--color-terminal-green": "#98971a",
    }),
  },
  "gruvbox-light": {
    id: "gruvbox-light",
    label: "Gruvbox Light",
    description: "gruvbox 라이트의 종이 질감 같은 따뜻한 테마예요.",
    colorScheme: "light",
    windowBackground: "#f9f5d7",
    colors: createThemeColors({
      "--color-app-bg": "#f9f5d7",
      "--color-app-window": "#f9f5d7",
      "--color-text-primary": "#3c3836",
      "--color-text-strong": "#282828",
      "--color-text-secondary": "#504945",
      "--color-text-muted": "#665c54",
      "--color-text-soft": "#7c6f64",
      "--color-text-faint": "#928374",
      "--color-text-subtle": "#928374",
      "--color-text-accent": "#076678",
      "--color-text-highlight": "#1d2021",
      "--color-text-tooltip": "#1d2021",
      "--color-text-overlay": "rgba(40, 40, 40, 0.84)",
      "--color-surface-terminal": "#fbf1c7",
      "--color-surface-terminal-theme": "#fbf1c7",
      "--color-surface-panel": "#f2e5bc",
      "--color-surface-dialog": "#f6edc9",
      "--color-surface-elevated": "#ebdbb2",
      "--color-surface-elevated-muted": "#e6d5ad",
      "--color-surface-elevated-active": "#ddc7a1",
      "--color-surface-hover": "#d8c29b",
      "--color-surface-chip": "#efe1b7",
      "--color-surface-preview": "#e2cca0",
      "--color-surface-tooltip": "#fff9dc",
      "--color-surface-empty": "rgba(242, 229, 188, 0.9)",
      "--color-surface-overlay": "rgba(60, 56, 54, 0.22)",
      "--color-surface-frost": "rgba(251, 241, 199, 0.84)",
      "--color-surface-frost-strong": "rgba(255, 249, 220, 0.96)",
      "--color-surface-launch": "rgba(251, 241, 199, 0.9)",
      "--color-surface-launch-hover": "rgba(235, 219, 178, 0.98)",
      "--color-surface-create-hover": "rgba(230, 213, 173, 0.9)",
      "--color-border-subtle": "rgba(60, 56, 54, 0.18)",
      "--color-border-muted": "rgba(60, 56, 54, 0.22)",
      "--color-border-soft": "rgba(60, 56, 54, 0.14)",
      "--color-border-ghost": "rgba(60, 56, 54, 0.1)",
      "--color-border-strong": "rgba(215, 153, 33, 0.34)",
      "--color-border-panel": "rgba(60, 56, 54, 0.14)",
      "--color-border-overlay": "rgba(60, 56, 54, 0.18)",
      "--color-border-create-hover": "rgba(215, 153, 33, 0.26)",
      "--color-border-launch": "rgba(215, 153, 33, 0.28)",
      "--color-tab-background": "#ebdbb2",
      "--color-tab-background-active": "#fbf1c7",
      "--color-tab-border": "rgba(60, 56, 54, 0.18)",
      "--color-tab-border-active": "rgba(215, 153, 33, 0.32)",
      "--color-tab-foreground": "#665c54",
      "--color-tab-foreground-active": "#282828",
      "--color-tab-create-foreground": "#7c6f64",
      "--color-tab-close-foreground": "#665c54",
      "--color-tab-indicator-start": "#d79921",
      "--color-tab-indicator-end": "#fe8019",
      "--shadow-tab-indicator": "0 0 0 1px rgba(215, 153, 33, 0.22)",
      "--shadow-tab-drag": "0 10px 24px rgba(60, 56, 54, 0.18)",
      "--shadow-dialog": "0 28px 80px rgba(60, 56, 54, 0.24)",
      "--shadow-tooltip": "0 16px 36px rgba(60, 56, 54, 0.2)",
      "--color-avatar-working": "#ddc7a1",
      "--color-avatar-thinking": "#d5c4a1",
      "--color-avatar-idle": "#ebdbb2",
      "--color-avatar-happy": "#d9ddb8",
      "--color-avatar-surprised": "#eccb93",
      "--color-avatar-sad": "#d8cfda",
      "--color-avatar-error": "#e5c1b7",
      "--color-avatar-image": "#efe1b7",
      "--color-avatar-orb": "#b57614",
      "--shadow-avatar-orb":
        "0 0 20px rgba(181, 118, 20, 0.24), inset 0 -4px 10px rgba(146, 84, 4, 0.18)",
      "--shadow-avatar-orb-strong":
        "0 0 24px rgba(181, 118, 20, 0.3), inset 0 -4px 10px rgba(146, 84, 4, 0.22)",
      "--color-terminal-foreground": "#3c3836",
      "--color-terminal-blue": "#076678",
      "--color-terminal-bright-blue": "#458588",
      "--color-terminal-green": "#79740e",
    }),
  },
};

export const APP_THEME_OPTIONS: AppThemeOption[] = Object.values(
  APP_THEME_PRESETS,
).map(({ id, label }) => {
  return { id, label };
});

export const APP_THEME_FALLBACKS = {
  windowBackground: APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].windowBackground,
  terminalBackground:
    APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].colors[
      "--color-surface-terminal-theme"
    ],
  terminalForeground:
    APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].colors[
      "--color-terminal-foreground"
    ],
  terminalBrightBlue:
    APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].colors[
      "--color-terminal-bright-blue"
    ],
  terminalBlue:
    APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].colors["--color-terminal-blue"],
  terminalGreen:
    APP_THEME_PRESETS[DEFAULT_APP_THEME_ID].colors["--color-terminal-green"],
};

export function createDefaultAppThemeSelection(): AppThemeSelection {
  return {
    themeId: DEFAULT_APP_THEME_ID,
  };
}

export function isAppThemeId(value: string): value is AppThemeId {
  return Object.hasOwn(APP_THEME_PRESETS, value);
}

export function getAppThemeDefinition(themeId: string): AppThemeDefinition {
  return isAppThemeId(themeId)
    ? APP_THEME_PRESETS[themeId]
    : APP_THEME_PRESETS[DEFAULT_APP_THEME_ID];
}
