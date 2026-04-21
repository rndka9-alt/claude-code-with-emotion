import type { ITheme } from "@xterm/xterm";
import { APP_THEME_FALLBACKS } from "../../../../shared/theme";

interface RgbColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export const terminalThemeFallbacks = {
  background: APP_THEME_FALLBACKS.terminalBackground,
  foreground: APP_THEME_FALLBACKS.terminalForeground,
  brightBlue: APP_THEME_FALLBACKS.terminalBrightBlue,
  blue: APP_THEME_FALLBACKS.terminalBlue,
  green: APP_THEME_FALLBACKS.terminalGreen,
};

export function readThemeVariable(name: string, fallback: string): string {
  const root = document.documentElement;
  const value = window.getComputedStyle(root).getPropertyValue(name).trim();

  return value.length > 0 ? value : fallback;
}

function parseHexByte(value: string): number | null {
  const parsedValue = Number.parseInt(value, 16);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseCssHexColor(value: string): RgbColor | null {
  const normalizedValue = value.trim();
  const shortHexMatch =
    /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])?$/.exec(
      normalizedValue,
    );

  if (shortHexMatch !== null) {
    const shortRed = shortHexMatch[1];
    const shortGreen = shortHexMatch[2];
    const shortBlue = shortHexMatch[3];
    const shortAlpha = shortHexMatch[4];

    if (
      shortRed === undefined ||
      shortGreen === undefined ||
      shortBlue === undefined
    ) {
      return null;
    }

    const red = parseHexByte(shortRed + shortRed);
    const green = parseHexByte(shortGreen + shortGreen);
    const blue = parseHexByte(shortBlue + shortBlue);
    const alpha =
      shortAlpha === undefined ? 255 : parseHexByte(shortAlpha + shortAlpha);

    if (red === null || green === null || blue === null || alpha === null) {
      return null;
    }

    return {
      alpha: alpha / 255,
      blue,
      green,
      red,
    };
  }

  const longHexMatch =
    /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})?$/.exec(
      normalizedValue,
    );

  if (longHexMatch !== null) {
    const longRed = longHexMatch[1];
    const longGreen = longHexMatch[2];
    const longBlue = longHexMatch[3];
    const longAlpha = longHexMatch[4];

    if (
      longRed === undefined ||
      longGreen === undefined ||
      longBlue === undefined
    ) {
      return null;
    }

    const red = parseHexByte(longRed);
    const green = parseHexByte(longGreen);
    const blue = parseHexByte(longBlue);
    const alpha = longAlpha === undefined ? 255 : parseHexByte(longAlpha);

    if (red === null || green === null || blue === null || alpha === null) {
      return null;
    }

    return {
      alpha: alpha / 255,
      blue,
      green,
      red,
    };
  }

  return null;
}

function parseCssRgbChannel(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    return null;
  }

  return parsedValue;
}

function parseCssAlphaChannel(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    return null;
  }

  return parsedValue;
}

function parseCssRgbColor(value: string): RgbColor | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const colorComponents = match[1];

  if (colorComponents === undefined) {
    return null;
  }

  const components = colorComponents
    .split(",")
    .map((component) => component.trim());

  if (components.length !== 3 && components.length !== 4) {
    return null;
  }

  const [redValue, greenValue, blueValue, alphaValue] = components;

  if (
    redValue === undefined ||
    greenValue === undefined ||
    blueValue === undefined
  ) {
    return null;
  }

  const red = parseCssRgbChannel(redValue);
  const green = parseCssRgbChannel(greenValue);
  const blue = parseCssRgbChannel(blueValue);
  const alpha = alphaValue === undefined ? 1 : parseCssAlphaChannel(alphaValue);

  if (red === null || green === null || blue === null || alpha === null) {
    return null;
  }

  return {
    alpha,
    blue,
    green,
    red,
  };
}

function parseCssColor(value: string): RgbColor | null {
  if (!value.startsWith("#") && !value.startsWith("rgb")) {
    return null;
  }

  return value.startsWith("#")
    ? parseCssHexColor(value)
    : parseCssRgbColor(value);
}

function toLinearColorChannel(value: number): number {
  const normalizedValue = value / 255;

  return normalizedValue <= 0.04045
    ? normalizedValue / 12.92
    : ((normalizedValue + 0.055) / 1.055) ** 2.4;
}

function isLightColor(value: string): boolean {
  const color = parseCssColor(value);

  if (color === null) {
    return false;
  }

  const luminance =
    0.2126 * toLinearColorChannel(color.red) +
    0.7152 * toLinearColorChannel(color.green) +
    0.0722 * toLinearColorChannel(color.blue);

  return luminance >= 0.6;
}

function createTerminalSelectionTheme(
  background: string,
): Pick<
  ITheme,
  "selectionBackground" | "selectionForeground" | "selectionInactiveBackground"
> {
  if (isLightColor(background)) {
    return {
      selectionBackground: "rgba(34, 78, 156, 0.42)",
      selectionForeground: "#fffaf2",
      selectionInactiveBackground: "rgba(34, 78, 156, 0.28)",
    };
  }

  return {
    selectionBackground: "rgba(155, 209, 255, 0.34)",
    selectionForeground: "#f7fbff",
    selectionInactiveBackground: "rgba(155, 209, 255, 0.24)",
  };
}

export function createTerminalTheme(): ITheme {
  const background = readThemeVariable(
    "--color-surface-terminal-theme",
    terminalThemeFallbacks.background,
  );

  return {
    background,
    foreground: readThemeVariable(
      "--color-terminal-foreground",
      terminalThemeFallbacks.foreground,
    ),
    brightBlue: readThemeVariable(
      "--color-terminal-bright-blue",
      terminalThemeFallbacks.brightBlue,
    ),
    blue: readThemeVariable(
      "--color-terminal-blue",
      terminalThemeFallbacks.blue,
    ),
    green: readThemeVariable(
      "--color-terminal-green",
      terminalThemeFallbacks.green,
    ),
    ...createTerminalSelectionTheme(background),
  };
}

export function createTerminalSearchDecorations(background: string): {
  activeMatchBackground: string;
  activeMatchBorder: string;
  activeMatchColorOverviewRuler: string;
  matchBackground: string;
  matchBorder: string;
  matchOverviewRuler: string;
} {
  if (isLightColor(background)) {
    return {
      activeMatchBackground: "#224E9C",
      activeMatchBorder: "#163A78",
      activeMatchColorOverviewRuler: "#163A78",
      matchBackground: "#E6C56F",
      matchBorder: "#B88719",
      matchOverviewRuler: "#B88719",
    };
  }

  return {
    activeMatchBackground: "#7DB4FF",
    activeMatchBorder: "#A9CEFF",
    activeMatchColorOverviewRuler: "#A9CEFF",
    matchBackground: "#37537A",
    matchBorder: "#6FA7F5",
    matchOverviewRuler: "#6FA7F5",
  };
}
