// dialog shell과 섹션들이 공유하는 스타일 상수만 모음. 섹션 전용 helper는 각 섹션 파일에 co-locate.

export const managerIconClassName = 'h-3.5 w-3.5';

export const managerActionButtonClassName =
  'inline-flex items-center justify-center gap-2 border border-[var(--color-border-muted)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-[var(--color-text-strong)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-highlight)]';

export const managerIconButtonClassName =
  'inline-flex h-[34px] w-[34px] items-center justify-center border border-[var(--color-border-muted)] bg-[var(--color-surface-elevated)] text-[var(--color-text-strong)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-highlight)]';

export const managerSectionCopyClassName =
  'mt-1 text-xs text-[var(--color-text-subtle)]';

export const managerChipClassName =
  'inline-flex items-center gap-2 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-[var(--color-text-secondary)]';

export const managerInputClassName =
  'w-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-[var(--color-text-tooltip)] outline-none transition-colors duration-150 focus:border-[var(--color-border-strong)]';

export function getManagerTabClassName(isActive: boolean): string {
  return [
    'border px-[14px] py-[9px] transition-colors duration-150',
    isActive
      ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-elevated-active)] text-[var(--color-text-primary)]'
      : 'border-[var(--color-border-soft)] bg-[var(--color-surface-elevated-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-highlight)]',
  ].join(' ');
}
