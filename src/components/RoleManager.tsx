/**
 * Global role columns: add, rename, reorder, remove.
 */

import { useState } from 'react'

import { EditableText } from './EditableText'
import { IconButton } from './IconButton'
import type { Role } from '../domain/types'
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from './icons'

export interface RoleManagerProps {
  roles: Role[]
  onAdd: (name: string) => void
  onRename: (roleId: string, name: string) => void
  onMove: (roleId: string, direction: 'up' | 'down') => void
  onRemove: (role: Role) => void
  /** Reported when a name is rejected as empty or duplicate. */
  onInvalidName: (message: string) => void
}

export function RoleManager({
  roles,
  onAdd,
  onRename,
  onMove,
  onRemove,
  onInvalidName,
}: RoleManagerProps) {
  const [draft, setDraft] = useState('')

  function submit() {
    const name = draft.trim()
    if (name.length === 0) return

    const clashes = roles.some(
      (role) => role.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (clashes) {
      onInvalidName(`A role named "${name}" already exists.`)
      return
    }

    onAdd(name)
    setDraft('')
  }

  return (
    <section
      aria-label="Roles"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Roles
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Shown as a column in every task table
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {roles.map((role, index) => (
          <li
            key={role.id}
            className="flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-0.5 dark:bg-slate-800/60 dark:border-slate-800"
          >
            <EditableText
              label="Role name"
              value={role.name}
              onCommit={(name) => onRename(role.id, name)}
              className="text-sm font-medium text-slate-800 dark:text-slate-200"
            />
            <IconButton
              label={`Move role ${role.name} left`}
              disabled={index === 0}
              onClick={() => onMove(role.id, 'up')}
              className="h-6 w-6"
            >
              <ChevronUpIcon className="h-3.5 w-3.5 -rotate-90" />
            </IconButton>
            <IconButton
              label={`Move role ${role.name} right`}
              disabled={index === roles.length - 1}
              onClick={() => onMove(role.id, 'down')}
              className="h-6 w-6"
            >
              <ChevronDownIcon className="h-3.5 w-3.5 -rotate-90" />
            </IconButton>
            <IconButton
              label={`Delete role ${role.name}`}
              tone="danger"
              onClick={() => onRemove(role)}
              className="h-6 w-6"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </IconButton>
          </li>
        ))}

        {roles.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">
            No roles yet — add one to start entering estimates.
          </li>
        )}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor="new-role" className="sr-only">
          New role name
        </label>
        <input
          id="new-role"
          type="text"
          value={draft}
          placeholder="Add a role, e.g. QA"
          onChange={(event) => setDraft(event.target.value)}
          className="w-56 rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900 dark:border-slate-700"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Role
        </button>
      </form>
    </section>
  )
}
