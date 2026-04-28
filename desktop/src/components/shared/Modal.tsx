import { useEffect, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, width = 560, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-overlay-scrim)] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        className="glass-panel relative max-h-[85vh] flex flex-col overflow-hidden rounded-[18px]"
        style={{ width, maxWidth: 'calc(100vw - 48px)' }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)]/60 px-6 py-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)]/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
