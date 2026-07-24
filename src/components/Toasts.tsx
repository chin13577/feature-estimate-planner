/**
 * Transient notifications.
 *
 * Rendered in an aria-live region so screen readers announce import results
 * and save failures without stealing focus.
 */

import { useEffect } from 'react'

import type { Notice } from '../state/ProjectProvider'

const AUTO_DISMISS_MS = 6000

export interface ToastsProps {
  notices: Notice[]
  onDismiss: (id: number) => void
}

export function Toasts({ notices, onDismiss }: ToastsProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({
  notice,
  onDismiss,
}: {
  notice: Notice
  onDismiss: (id: number) => void
}) {
  useEffect(() => {
    // Errors stay until dismissed: a failed save is not something to miss.
    if (notice.tone === 'error') return

    const timer = setTimeout(() => onDismiss(notice.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notice.id, notice.tone, onDismiss])

  const toneClasses = {
    info: 'border-slate-300 bg-white text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    error: 'border-red-300 bg-red-50 text-red-900',
  }[notice.tone]

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 shadow-lg ${toneClasses}`}
    >
      <p className="min-w-0 flex-1 whitespace-pre-line text-sm">
        {notice.message}
      </p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(notice.id)}
        className="shrink-0 rounded px-1 text-lg leading-none opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        ×
      </button>
    </div>
  )
}
