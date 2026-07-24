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
  /** Grid coordinates, used for arrow-key navigation between cells. */
  rowIndex?: number
  columnIndex?: number
}

/**
 * Marks an estimate cell so siblings can be found by coordinate.
 * Scoped per feature table, since each renders its own grid.
 */
export const ESTIMATE_CELL_ATTR = 'data-estimate-cell'

function moveFocus(
  from: HTMLElement,
  rowIndex: number,
  columnIndex: number,
  rowDelta: number,
  columnDelta: number,
): boolean {
  // The owning table bounds the search, so arrow keys never jump between
  // features.
  const table = from.closest('table')
  if (table === null) return false

  const target = table.querySelector<HTMLInputElement>(
    `[${ESTIMATE_CELL_ATTR}="${rowIndex + rowDelta}:${columnIndex + columnDelta}"]`,
  )
  if (target === null) return false

  target.focus()
  return true
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
  rowIndex,
  columnIndex,
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
    'w-full rounded border border-transparent bg-transparent px-2 py-1 text-right tabular-nums focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-sky-900'

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
      {...(rowIndex !== undefined && columnIndex !== undefined
        ? { [ESTIMATE_CELL_ATTR]: `${rowIndex}:${columnIndex}` }
        : {})}
      onKeyDown={(event) => {
        const input = event.currentTarget
        const navigable = rowIndex !== undefined && columnIndex !== undefined

        if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(toDraft(value))
          setFocused(false)
          input.blur()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          // Enter commits and steps down a row, the spreadsheet convention;
          // on the last row it simply commits.
          if (!navigable || !moveFocus(input, rowIndex, columnIndex, 1, 0)) {
            input.blur()
          }
          return
        }

        if (!navigable) return

        // Left/right would otherwise move the caret, so only navigate when
        // the caret is already at that end of the text.
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0
        const atEnd =
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length

        const moves: Record<string, [number, number] | undefined> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: atStart ? [0, -1] : undefined,
          ArrowRight: atEnd ? [0, 1] : undefined,
        }

        const delta = moves[event.key]
        if (delta === undefined) return

        // Up/down on a number input would step the value; navigating instead.
        if (moveFocus(input, rowIndex, columnIndex, delta[0], delta[1])) {
          event.preventDefault()
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          // No neighbour, but still suppress the spinner's value change.
          event.preventDefault()
        }
      }}
      className={`${shared} ${
        disabled
          ? 'cursor-not-allowed'
          : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    />
  )
}
