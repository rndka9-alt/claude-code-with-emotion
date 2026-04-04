// dialog shell과 섹션들이 공유하는 스타일 상수만 모음. 섹션 전용 helper는 각 섹션 파일에 co-locate.

export const managerIconClassName = 'h-3.5 w-3.5';

export const managerActionButtonClassName =
  'inline-flex items-center justify-center gap-2 border border-border-muted bg-surface-elevated px-2.5 py-2 text-text-strong transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight';

export const managerIconButtonClassName =
  'inline-flex h-[34px] w-[34px] items-center justify-center border border-border-muted bg-surface-elevated text-text-strong transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight';

export const managerSectionCopyClassName =
  'mt-1 text-xs text-text-subtle';

export const managerChipClassName =
  'inline-flex items-center gap-2 border border-border-soft bg-surface-elevated px-2.5 py-1.5 text-text-secondary';

export const managerInputClassName =
  'w-full border border-border-soft bg-surface-elevated px-3 py-2.5 text-text-tooltip outline-none transition-colors duration-150 focus:border-border-strong';

export function getManagerTabClassName(isActive: boolean): string {
  return [
    'border px-[14px] py-[9px] transition-colors duration-150',
    isActive
      ? 'border-border-strong bg-surface-elevated-active text-text-primary'
      : 'border-border-soft bg-surface-elevated-muted text-text-muted hover:bg-surface-elevated hover:text-text-highlight',
  ].join(' ');
}
