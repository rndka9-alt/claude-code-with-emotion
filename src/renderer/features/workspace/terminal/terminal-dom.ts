export interface ScheduledTask {
  cancel: () => void;
}

export function scheduleTask(
  callback: () => void,
  delayMs: number,
): ScheduledTask {
  const timeoutId = window.setTimeout(callback, delayMs);

  return {
    cancel: () => {
      window.clearTimeout(timeoutId);
    },
  };
}

function createParkingLot(): HTMLDivElement {
  const parkingLot = document.createElement("div");

  parkingLot.setAttribute("aria-hidden", "true");
  parkingLot.dataset.terminalParkingLot = "true";
  parkingLot.style.position = "fixed";
  parkingLot.style.left = "-10000px";
  parkingLot.style.top = "0";
  parkingLot.style.width = "1px";
  parkingLot.style.height = "1px";
  parkingLot.style.overflow = "hidden";
  parkingLot.style.pointerEvents = "none";

  document.body.append(parkingLot);

  return parkingLot;
}

export function createTerminalContainer(): HTMLDivElement {
  const container = document.createElement("div");

  container.className = "terminal-surface__instance";
  container.style.width = "100%";
  container.style.height = "100%";

  return container;
}

function isExternalBrowserHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;

    return (
      protocol === "http:" || protocol === "https:" || protocol === "vscode:"
    );
  } catch {
    return false;
  }
}

export function handleTerminalExternalBrowserClick(
  event: Pick<MouseEvent, "defaultPrevented" | "preventDefault" | "target">,
  openExternal: ((url: string) => Promise<void>) | undefined,
): void {
  if (event.defaultPrevented || !(event.target instanceof Element)) {
    return;
  }

  const anchor = event.target.closest("a[href]");

  if (
    !(anchor instanceof HTMLAnchorElement) ||
    !isExternalBrowserHref(anchor.href)
  ) {
    return;
  }

  event.preventDefault();
  void openExternal?.(anchor.href);
}

let terminalParkingLot: HTMLDivElement | null = null;

export function getParkingLot(): HTMLDivElement {
  if (
    terminalParkingLot === null ||
    !document.body.contains(terminalParkingLot)
  ) {
    terminalParkingLot = createParkingLot();
  }

  return terminalParkingLot;
}

export function disposeParkingLot(): void {
  terminalParkingLot?.remove();
  terminalParkingLot = null;
}
