import fs from "node:fs";
import path from "node:path";
import {
  createDefaultAppThemeSelection,
  isAppThemeId,
  type AppThemeSelection,
} from "../../shared/theme";

type ThemeListener = (selection: AppThemeSelection) => void;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeThemeSelection(candidate: {
  themeId: string;
}): AppThemeSelection {
  return isAppThemeId(candidate.themeId)
    ? { themeId: candidate.themeId }
    : createDefaultAppThemeSelection();
}

function parseThemeSelectionFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): AppThemeSelection {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);

    if (!isObjectRecord(parsed) || typeof parsed.themeId !== "string") {
      logEvent?.("app theme selection on disk had an invalid shape");
      return createDefaultAppThemeSelection();
    }

    const themeId = parsed.themeId;

    return sanitizeThemeSelection({ themeId });
  } catch (error) {
    if (error instanceof Error && error.name !== "ENOENT") {
      logEvent?.(`failed to read app theme selection: ${error.message}`);
    }

    return createDefaultAppThemeSelection();
  }
}

function persistThemeSelectionIfMissing(
  filePath: string,
  selection: AppThemeSelection,
  logEvent?: (message: string) => void,
): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(selection, null, 2), "utf8");
  logEvent?.("initialized default app theme selection on disk");
}

export class ThemeStore {
  private selection: AppThemeSelection;
  private readonly listeners = new Set<ThemeListener>();

  constructor(
    private readonly filePath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.selection = parseThemeSelectionFromDisk(filePath, logEvent);
    persistThemeSelectionIfMissing(filePath, this.selection, logEvent);
  }

  getSelection(): AppThemeSelection {
    return this.selection;
  }

  replaceSelection(nextSelection: AppThemeSelection): AppThemeSelection {
    const sanitizedSelection = sanitizeThemeSelection(nextSelection);

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(sanitizedSelection, null, 2),
      "utf8",
    );
    this.selection = sanitizedSelection;
    this.emit();
    this.logEvent?.(
      `saved app theme selection theme=${sanitizedSelection.themeId}`,
    );

    return sanitizedSelection;
  }

  subscribe(listener: ThemeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.selection);
    }
  }
}
