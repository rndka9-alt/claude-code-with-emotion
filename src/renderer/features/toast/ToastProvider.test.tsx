import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { ToastProvider, useToast } from "./ToastProvider";

function ToastTrigger(props: {
  onReady: (controller: ReturnType<typeof useToast>) => void;
}): ReactElement {
  const controller = useToast();
  props.onReady(controller);

  return <div data-testid="toast-trigger">ready</div>;
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast message and auto-dismisses after the duration", () => {
    let controller: ReturnType<typeof useToast> | null = null;

    render(
      <ToastProvider>
        <ToastTrigger
          onReady={(nextController) => {
            controller = nextController;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller?.showToast({
        message: "happy 를 A 에서 B 로 옮겻어요",
        durationMs: 3000,
      });
    });

    expect(
      screen.getByText("happy 를 A 에서 B 로 옮겻어요"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(
      screen.queryByText("happy 를 A 에서 B 로 옮겻어요"),
    ).not.toBeInTheDocument();
  });

  it("invokes the action handler and dismisses the toast when pressed", () => {
    let controller: ReturnType<typeof useToast> | null = null;
    const onAction = vi.fn();

    render(
      <ToastProvider>
        <ToastTrigger
          onReady={(nextController) => {
            controller = nextController;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller?.showToast({
        message: "swap 실행",
        action: {
          label: "되돌리기",
          onAction,
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("swap 실행")).not.toBeInTheDocument();
  });

  it("keeps sticky toasts until dismissed manually", () => {
    let controller: ReturnType<typeof useToast> | null = null;

    render(
      <ToastProvider>
        <ToastTrigger
          onReady={(nextController) => {
            controller = nextController;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller?.showToast({
        message: "끈적한 토스트",
        durationMs: 0,
      });
    });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("끈적한 토스트")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "알림 닫기" }));

    expect(screen.queryByText("끈적한 토스트")).not.toBeInTheDocument();
  });
});
