import type { MenuItemConstructorOptions } from "electron";
import { createApplicationMenuTemplate } from "./application-menu";

function getSubmenuItems(
  item: MenuItemConstructorOptions | undefined,
): MenuItemConstructorOptions[] {
  if (item === undefined) {
    return [];
  }

  const { submenu } = item;

  if (Array.isArray(submenu)) {
    return submenu;
  }

  return [];
}

describe("createApplicationMenuTemplate", () => {
  it("adds a native Edit menu with copy and paste roles", () => {
    const template = createApplicationMenuTemplate("Claude Code With Emotion", {
      openTerminalSearch: vi.fn(),
    });
    const editMenu = template.find((item) => item.label === "Edit");
    const editRoles = getSubmenuItems(editMenu).map((item) => item.role);

    expect(editRoles).toContain("copy");
    expect(editRoles).toContain("paste");
    expect(editRoles).toContain("selectAll");
  });

  it("adds a Find menu item with the standard shortcut", () => {
    const openTerminalSearch = vi.fn();
    const template = createApplicationMenuTemplate("Claude Code With Emotion", {
      openTerminalSearch,
    });
    const editMenu = template.find((item) => item.label === "Edit");
    const findItem = getSubmenuItems(editMenu).find((item) => {
      return item.label === "Find";
    });

    expect(findItem).toMatchObject({
      accelerator: "CommandOrControl+F",
      label: "Find",
    });

    if (findItem?.click === undefined) {
      throw new Error("Expected Find menu item click handler to exist");
    }

    Reflect.apply(findItem.click, findItem, [
      Object.create(null),
      undefined,
      undefined,
    ]);

    expect(openTerminalSearch).toHaveBeenCalledTimes(1);
  });
});
