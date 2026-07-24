/**
 * Checkbox supporting the spec's three states: enabled, disabled, partial.
 *
 * `indeterminate` is not an HTML attribute — it can only be set on the DOM
 * node — so this component owns a ref to apply it.
 */

import { useEffect, useRef } from 'react'

import type { EnabledState } from '../domain/enabledState'

export interface TriStateCheckboxProps {
  state: EnabledState
  onChange: (enabled: boolean) => void
  label: string
  className?: string
}

export function TriStateCheckbox({
  state,
  onChange,
  label,
  className = '',
}: TriStateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = state === 'partial'
    }
  }, [state])

  return (
    <input
      ref={ref}
      type="checkbox"
      // A partial parent is itself enabled, so it reads as checked; the
      // indeterminate flag is what conveys "some children are off".
      checked={state !== 'disabled'}
      aria-label={label}
      aria-checked={state === 'partial' ? 'mixed' : state === 'enabled'}
      onChange={(event) => onChange(event.target.checked)}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-slate-400 text-sky-600 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 dark:border-slate-500 dark:bg-slate-800 dark:ring-offset-slate-900 ${className}`}
    />
  )
}
