import type { MenuItemConstructorOptions } from "electron";

interface ApplicationMenuHandlers {
  openTerminalSearch: () => void;
}

export function createApplicationMenuTemplate(
  appName: string,
  handlers: ApplicationMenuHandlers,
): MenuItemConstructorOptions[] {
  return [
    {
      label: appName,
      submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { type: "separator" },
        {
          accelerator: "CommandOrControl+F",
          click: () => {
            handlers.openTerminalSearch();
          },
          label: "Find",
        },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];
}
