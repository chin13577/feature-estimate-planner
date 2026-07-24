/**
 * Dropdown listing every project saved in this browser.
 *
 * Opening, duplicating, and deleting are all driven from here; renaming stays
 * in the header, where the open project's name is already editable.
 */

import { useEffect, useRef, useState } from 'react'

import type { ProjectSummaryEntry } from '../state/ProjectProvider'
import { IconButton } from './IconButton'
import { CheckIcon, ChevronDownIcon, CopyIcon, FolderIcon, TrashIcon } from './icons'

export interface ProjectSwitcherProps {
  projects: ProjectSummaryEntry[]
  activeProjectId: string
  onOpen: (projectId: string) => void
  onDuplicate: (projectId: string) => void
  onDelete: (entry: ProjectSummaryEntry) => void
}

/** "3 minutes ago" style stamp — precise dates are not useful here. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Date(iso).toLocaleDateString()
}

export function ProjectSwitcher({
  projects,
  activeProjectId,
  onOpen,
  onDuplicate,
  onDelete,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FolderIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Projects</span>
        <span className="rounded bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {projects.length}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Saved projects"
          className="absolute right-0 z-40 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {projects.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
              No saved projects yet.
            </p>
          )}

          {projects.map((entry) => {
            const isActive = entry.id === activeProjectId

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 ${
                  isActive ? 'bg-sky-50 dark:bg-sky-950/40' : ''
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpen(entry.id)
                    setOpen(false)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-slate-800"
                >
                  <CheckIcon
                    className={`h-4 w-4 shrink-0 ${
                      isActive
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'invisible'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {entry.name}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {isActive ? 'Open' : `Edited ${formatRelative(entry.updatedAt)}`}
                    </span>
                  </span>
                </button>

                <IconButton
                  label={`Duplicate project ${entry.name}`}
                  onClick={() => {
                    onDuplicate(entry.id)
                    setOpen(false)
                  }}
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label={`Delete project ${entry.name}`}
                  tone="danger"
                  onClick={() => {
                    onDelete(entry)
                    setOpen(false)
                  }}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
