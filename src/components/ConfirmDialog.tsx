/**
 * Modal confirmation for destructive actions.
 *
 * Focus handling lives in {@link Modal}; this owns only the content and the
 * two buttons.
 */

import { useEffect, useRef } from 'react'

import { Modal } from './Modal'

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
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Modal focuses its first control, which is Cancel. For a destructive
  // action that is the safer default, but the confirm button is the one the
  // user came here to press — focus it once the dialog has opened.
  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
      : 'bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-500'

  return (
    <Modal
      open={open}
      onClose={onCancel}
      role="alertdialog"
      labelledBy="confirm-dialog-title"
      describedBy={description ? 'confirm-dialog-description' : undefined}
    >
      <h2
        id="confirm-dialog-title"
        className="text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        {title}
      </h2>

      {description !== undefined && (
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm text-slate-600 dark:text-slate-300"
        >
          {description}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className={`rounded px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${confirmClasses}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
