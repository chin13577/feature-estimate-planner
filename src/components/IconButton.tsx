/**
 * Compact action button.
 *
 * Icon-only buttons still carry an accessible name via `label`, which doubles
 * as the tooltip — the spec requires every button to have text or an aria-label.
 */

import type { ReactNode } from 'react'

export interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  tone?: 'default' | 'danger'
  className?: string
}

export function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  tone = 'default',
  className = '',
}: IconButtonProps) {
  const toneClasses =
    tone === 'danger'
      ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
      : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${toneClasses} ${className}`}
    >
      {children}
    </button>
  )
}
