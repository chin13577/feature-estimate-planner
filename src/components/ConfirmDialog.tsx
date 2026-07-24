/**
 * Modal confirmation for destructive actions.
 *
 * Keyboard accessible per the spec: Escape cancels, focus moves into the
 * dialog on open and is trapped within it, and it returns to the trigger on
 * close.
 */

import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Optional detail, e.g. "This will permanently remove 3 tasks…". */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()

    return () => {
      // Return focus to whatever opened the dialog.
      previouslyFocused.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab') return

      // Trap focus: with only two buttons, wrapping by hand is simpler and
      // more predictable than querying the DOM for focusable nodes.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      )
      if (focusable === undefined || focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
      : 'bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself dismisses; dragging out of the
        // dialog should not.
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h2>

        {description !== undefined && (
          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm text-slate-600"
          >
            {description}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
