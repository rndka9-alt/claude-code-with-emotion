// 토스트 통신 타입. Provider·훅·렌더러가 공유해요.

export type ToastTone = "info" | "warning" | "success";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastHandle {
  id: string;
  dismiss: () => void;
}

export interface ToastController {
  showToast: (input: ToastInput) => ToastHandle;
  dismissToast: (id: string) => void;
}

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number | null;
  action: ToastAction | null;
}

// durationMs 미지정 시 쓰는 기본 노출 시간. undo 같은 action 이 있을 때 넉넉히 보여주려고 7초로 맞춰요.
export const DEFAULT_TOAST_DURATION_MS = 6000;
