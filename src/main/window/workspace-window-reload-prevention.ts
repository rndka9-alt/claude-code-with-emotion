import type { BrowserWindow, Input } from "electron";

export function attachWorkspaceWindowReloadPrevention(
  workspaceWindow: BrowserWindow,
): void {
  workspaceWindow.webContents.on("before-input-event", (_event, input) => {
    workspaceWindow.webContents.setIgnoreMenuShortcuts(
      shouldIgnoreMenuShortcutsForReload(input, process.platform),
    );
  });
}

export function shouldIgnoreMenuShortcutsForReload(
  input: Input,
  platform: NodeJS.Platform,
): boolean {
  if (input.type !== "keyDown" || input.isComposing) {
    return false;
  }

  if (isCommandOrControlReload(input, platform)) {
    return true;
  }

  return isFunctionReload(input);
}

function isCommandOrControlReload(
  input: Input,
  platform: NodeJS.Platform,
): boolean {
  if (input.alt || input.key.toLowerCase() !== "r") {
    return false;
  }

  if (platform === "darwin") {
    return input.meta && !input.control;
  }

  return input.control && !input.meta;
}

function isFunctionReload(input: Input): boolean {
  return (
    !input.alt &&
    !input.meta &&
    (input.key === "F5" || input.code === "F5")
  );
}
