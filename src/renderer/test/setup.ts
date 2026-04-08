import "@testing-library/jest-dom";
import { afterEach } from "vitest";

class ResizeObserverStub {
  observe(_target?: Element): void {}

  unobserve(_target?: Element): void {}

  disconnect(): void {}
}

if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = ResizeObserverStub;
}

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener(): void {},
        removeListener(): void {},
        addEventListener(): void {},
        removeEventListener(): void {},
        dispatchEvent(): boolean {
          return false;
        },
      };
    },
  });
}

if (typeof window.PointerEvent === "undefined") {
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: MouseEvent,
  });
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => {
    return {
      createLinearGradient: () => {
        return {
          addColorStop(): void {},
        };
      },
      fillRect(): void {},
      getImageData: () => {
        return {
          data: [0, 0, 0, 0],
        };
      },
    };
  },
});

afterEach(() => {
  return import("../features/workspace/terminal").then(
    ({ disposeAllTerminalSessions }) => {
      disposeAllTerminalSessions();
    },
  );
});
