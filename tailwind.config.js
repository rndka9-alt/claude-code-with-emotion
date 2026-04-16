/**
 * ESLint 전용 Tailwind 설정.
 *
 * 실제 빌드는 @tailwindcss/vite + src/renderer/styles.css @theme 가 담당한다.
 * 이 파일은 eslint-plugin-tailwindcss 가 커스텀 토큰을 인식하기 위한 용도로만 존재한다.
 *
 * ⚠️  styles.css @theme 를 수정하면 이 파일도 반드시 동기화해야 한다.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --color-app-*
        "app-bg": "#11141a",
        "app-window": "#101218",

        // --color-text-*
        "text-primary": "#f3f7ff",
        "text-strong": "#e9eefc",
        "text-secondary": "#d5def4",
        "text-muted": "#b8c6e5",
        "text-soft": "#b7c4e2",
        "text-faint": "#b3c1df",
        "text-subtle": "#8f9dbd",
        "text-accent": "#92a7d8",
        "text-highlight": "#f4f8ff",
        "text-tooltip": "#eef3ff",
        "text-overlay": "rgba(241, 246, 255, 0.88)",
        "text-inverse": "#ffffff",
        "text-warning": "#f5b04a",

        // --color-surface-*
        "surface-terminal": "#0b0f17",
        "surface-terminal-theme": "#0b1019",
        "surface-panel": "#10141d",
        "surface-dialog": "#0f1319",
        "surface-elevated": "#171d28",
        "surface-elevated-muted": "#141923",
        "surface-elevated-active": "#1b2331",
        "surface-hover": "#262d39",
        "surface-chip": "#121723",
        "surface-preview": "#0a0d14",
        "surface-tooltip": "#0d121a",
        "surface-empty": "rgba(20, 24, 32, 0.72)",
        "surface-overlay": "rgba(7, 9, 14, 0.72)",
        "surface-frost": "rgba(11, 15, 23, 0.72)",
        "surface-frost-strong": "rgba(28, 35, 49, 0.94)",
        "surface-launch": "rgba(8, 12, 19, 0.82)",
        "surface-launch-hover": "rgba(35, 50, 78, 0.96)",
        "surface-create-hover": "rgba(35, 42, 56, 0.88)",

        // --color-border-*
        "border-subtle": "rgba(121, 137, 175, 0.22)",
        "border-muted": "rgba(121, 137, 175, 0.24)",
        "border-soft": "rgba(121, 137, 175, 0.2)",
        "border-ghost": "rgba(121, 137, 175, 0.14)",
        "border-strong": "rgba(143, 165, 216, 0.48)",
        "border-panel": "rgba(138, 163, 228, 0.16)",
        "border-overlay": "rgba(180, 199, 238, 0.24)",
        "border-create-hover": "rgba(176, 196, 255, 0.3)",
        "border-launch": "rgba(174, 198, 244, 0.4)",

        // --color-tab-*
        "tab-background": "#161a22",
        "tab-background-active": "#0f1319",
        "tab-border": "rgba(121, 137, 175, 0.28)",
        "tab-border-active": "rgba(145, 161, 201, 0.42)",
        "tab-foreground": "#9caacf",
        "tab-foreground-active": "#f5f8ff",
        "tab-create-foreground": "#bac7e8",
        "tab-close-foreground": "#d2dcf7",
        "tab-notification": "#ef4444",
        "tab-indicator-start": "#d5e3ff",
        "tab-indicator-end": "#8db1ff",

        // --color-avatar-*
        "avatar-working": "#1a2233",
        "avatar-thinking": "#202638",
        "avatar-idle": "#171d2c",
        "avatar-happy": "#1c2c39",
        "avatar-surprised": "#3d2a17",
        "avatar-sad": "#232838",
        "avatar-error": "#4b1e1e",
        "avatar-image": "#0b0f17",
        "avatar-orb": "#6b8ff7",

        // --color-terminal-*
        "terminal-foreground": "#f4f7ff",
        "terminal-blue": "#6a8aff",
        "terminal-bright-blue": "#92bcff",
        "terminal-green": "#8fe4b6",
      },
      boxShadow: {
        "tab-indicator": "0 0 0 1px rgba(141, 177, 255, 0.22)",
        "tab-drag": "0 10px 24px rgba(4, 8, 15, 0.34)",
        dialog: "0 28px 80px rgba(0, 0, 0, 0.44)",
        tooltip: "0 16px 36px rgba(0, 0, 0, 0.32)",
        "avatar-orb":
          "0 0 20px rgba(118, 159, 255, 0.32), inset 0 -4px 10px rgba(45, 69, 196, 0.26)",
        "avatar-orb-strong":
          "0 0 24px rgba(118, 159, 255, 0.38), inset 0 -4px 10px rgba(45, 69, 196, 0.28)",
      },
    },
  },
};
