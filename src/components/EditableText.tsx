/**
 * Inline-editable label.
 *
 * Click (or focus and press Enter) to edit. Enter confirms, Escape cancels, and
 * an empty value restores the previous name — the spec's rules for every
 * editable name in the app.
 */

import { useEffect, useRef, useState } from 'react'

export interface EditableTextProps {
  value: string
  onCommit: (value: string) => void
  /** Describes the field for screen readers, e.g. "Phase name". */
  label: string
  className?: string
  inputClassName?: string
  placeholder?: string
}

export function EditableText({
  value,
  onCommit,
  label,
  className = '',
  inputClassName = '',
  placeholder,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-sync when the value changes underneath us (import, undo, duplicate).
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    // An empty name restores the previous one rather than clearing the field.
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value)
      return
    }
    onCommit(trimmed)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
        className={`min-w-0 rounded border border-sky-500 bg-white px-2 py-1 text-inherit font-inherit outline-none ring-2 ring-sky-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-sky-900 ${inputClassName}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      // Enter on a focused button already fires onClick; this makes the
      // affordance explicit for keyboard users arriving by Tab.
      title={`${label}: click to edit`}
      className={`min-w-0 truncate rounded px-2 py-1 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-slate-800 ${className}`}
    >
      {value.length > 0 ? value : (placeholder ?? 'Untitled')}
    </button>
  )
}
