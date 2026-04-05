import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  DEFAULT_TOAST_DURATION_MS,
  type ToastController,
  type ToastHandle,
  type ToastInput,
  type ToastItem,
  type ToastTone,
} from "./toast-types";

const ToastControllerContext = createContext<ToastController | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

function createToastId(): string {
  // crypto.randomUUID 는 jsdom 에서도 잇고, 전역 모두 지원해요. 카운터 쓰면 리로드 직후 id 충돌할 일이 읍어서 이게 안전.
  return `toast-${crypto.randomUUID()}`;
}

function toneClassName(tone: ToastTone): string {
  // 토스트 좌측 악센트바 색. 다이얼로그/패널과 같은 토큰만 사용.
  if (tone === "warning") {
    return "border-l-text-warning";
  }

  if (tone === "success") {
    return "border-l-terminal-green";
  }

  return "border-l-terminal-blue";
}

export function ToastProvider({ children }: ToastProviderProps): ReactElement {
  const [items, setItems] = useState<ReadonlyArray<ToastItem>>([]);

  const dismissToast = useCallback((id: string): void => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput): ToastHandle => {
      const id = createToastId();
      const durationMs =
        input.durationMs === undefined
          ? DEFAULT_TOAST_DURATION_MS
          : input.durationMs;

      const item: ToastItem = {
        id,
        message: input.message,
        tone: input.tone ?? "info",
        // 0 이하를 sticky 로 해석. null 로 저장해서 렌더러가 타이머를 안 걸도록.
        durationMs: durationMs > 0 ? durationMs : null,
        action: input.action ?? null,
      };

      setItems((current) => [...current, item]);

      return {
        id,
        dismiss: () => {
          dismissToast(id);
        },
      };
    },
    [dismissToast],
  );

  const controller = useMemo<ToastController>(
    () => ({
      showToast,
      dismissToast,
    }),
    [showToast, dismissToast],
  );

  return (
    <ToastControllerContext.Provider value={controller}>
      {children}
      <ToastViewport items={items} onDismiss={dismissToast} />
    </ToastControllerContext.Provider>
  );
}

export function useToast(): ToastController {
  const controller = useContext(ToastControllerContext);

  if (controller === null) {
    throw new Error(
      "useToast 는 ToastProvider 하위에서만 호출할 수 있어요...!",
    );
  }

  return controller;
}

interface ToastViewportProps {
  items: ReadonlyArray<ToastItem>;
  onDismiss: (id: string) => void;
}

function ToastViewport({
  items,
  onDismiss,
}: ToastViewportProps): ReactElement | null {
  // SSR 방어용. jsdom 에도 document 는 잇지만, portal 이용이 안전해요.
  if (typeof document === "undefined") {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2"
      role="status"
    >
      {items.map((item) => {
        return (
          <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
        );
      })}
    </div>,
    document.body,
  );
}

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps): ReactElement {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (item.durationMs === null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      onDismissRef.current(item.id);
    }, item.durationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [item.id, item.durationMs]);

  return (
    <div
      className={`pointer-events-auto flex min-w-[260px] max-w-[360px] items-start gap-3 border border-border-soft border-l-4 bg-surface-frost-strong px-3 py-2.5 text-sm text-text-secondary shadow-tooltip ${toneClassName(
        item.tone,
      )}`}
      data-testid="toast-card"
    >
      <p className="m-0 flex-1 leading-snug">{item.message}</p>

      {item.action !== null ? (
        <button
          className="shrink-0 border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text-highlight transition-colors duration-150 hover:bg-surface-hover"
          onClick={() => {
            if (item.action !== null) {
              item.action.onAction();
            }
            onDismiss(item.id);
          }}
          type="button"
        >
          {item.action.label}
        </button>
      ) : null}

      <button
        aria-label="알림 닫기"
        className="shrink-0 inline-flex h-[22px] w-[22px] items-center justify-center bg-transparent text-text-subtle transition-colors duration-150 hover:text-text-highlight"
        onClick={() => {
          onDismiss(item.id);
        }}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
