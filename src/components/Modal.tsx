/**
 * Modal shell: backdrop, focus trap, Escape handling, focus restoration.
 *
 * Extracted so ConfirmDialog and ImportDialog behave identically — the focus
 * rules are the part most easily got wrong, and having one implementation
 * means fixing them once.
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Everything that can hold focus inside a dialog. `[tabindex="-1"]` is
 * excluded deliberately: those are programmatic focus targets, not stops in
 * the Tab order.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** ID of the element labelling the dialog, for aria-labelledby. */
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
  className?: string
}

export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  children,
  className = 'max-w-md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Held in a ref so the Tab handler does not need to re-bind when the
  // caller passes a new onClose identity on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Focus the first control rather than the dialog box, so keyboard users
    // land somewhere actionable.
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    if (first !== null && first !== undefined) {
      first.focus()
    } else {
      dialogRef.current?.focus()
    }

    return () => {
      previouslyFocused.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (nodes === undefined || nodes.length === 0) return

      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      const active = document.activeElement

      // Wrap at both ends, and pull focus back in if it escaped the dialog.
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-slate-950/70"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself dismisses; dragging out of the
        // dialog should not.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`w-full rounded-lg bg-white p-5 shadow-xl outline-none dark:bg-slate-900 ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
