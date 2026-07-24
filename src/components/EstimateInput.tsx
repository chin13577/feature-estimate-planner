/**
 * Man-day estimate cell.
 *
 * Shows `-` for blank or zero when unfocused, and a numeric input when focused.
 * Negative and non-finite values are rejected; blank commits as `null` so the
 * data keeps the distinction between "not entered" and "explicitly zero".
 */

import { useEffect, useState } from 'react'

import type { EstimateValue } from '../domain/types'

export interface EstimateInputProps {
  value: EstimateValue
  onCommit: (value: EstimateValue) => void
  /** Full context for screen readers, e.g. "Developer estimate for Login". */
  label: string
  disabled?: boolean
}

function toDraft(value: EstimateValue): string {
  return value === null || value === 0 ? '' : String(value)
}

/**
 * What the cell shows when it is not focused. Blank and zero both render as
 * `-`, per the spec — a zero the user typed is still visually "nothing".
 */
function toDisplay(value: EstimateValue): string {
  return value === null || value === 0 ? '-' : String(value)
}

export function EstimateInput({
  value,
  onCommit,
  label,
  disabled = false,
}: EstimateInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(value))

  useEffect(() => {
    if (!focused) setDraft(toDraft(value))
  }, [value, focused])

  function commit(raw: string) {
    const trimmed = raw.trim()

    if (trimmed.length === 0) {
      onCommit(null)
      return
    }

    const parsed = Number(trimmed)
    // Reject anything the reducer would refuse, restoring the last good value
    // so the cell never displays something that was not stored.
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(toDraft(value))
      return
    }

    onCommit(parsed)
  }

  const shared =
    'w-full rounded border border-transparent bg-transparent px-2 py-1 text-right tabular-nums focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200'

  return (
    <input
      // `text` while unfocused so the `-` placeholder can be shown at all; a
      // number input cannot display a non-numeric string.
      type={focused ? 'number' : 'text'}
      min="0"
      step="0.25"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={focused ? draft : toDisplay(value)}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => {
        setFocused(true)
        setDraft(toDraft(value))
        // Deferred: the value swaps to the draft on this same tick, and
        // selecting before that would select the `-`.
        requestAnimationFrame(() => event.target.select())
      }}
      onBlur={(event) => {
        setFocused(false)
        commit(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(toDraft(value))
          setFocused(false)
          event.currentTarget.blur()
        }
      }}
      className={`${shared} ${disabled ? 'cursor-not-allowed' : 'hover:border-slate-300'}`}
    />
  )
}
