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
    const template = createApplicationMenuTemplate("Claude Code With Emotion");
    const editMenu = template.find((item) => item.label === "Edit");
    const editRoles = getSubmenuItems(editMenu).map((item) => item.role);

    expect(editRoles).toContain("copy");
    expect(editRoles).toContain("paste");
    expect(editRoles).toContain("selectAll");
  });
});
