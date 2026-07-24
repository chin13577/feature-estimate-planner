/**
 * Title bar, editable project name, and the project-level actions.
 *
 * The local-storage warning sits next to Import/Export deliberately — the spec
 * asks for it near those controls, where a user is already thinking about
 * moving their data.
 */

import { useRef } from 'react'

import type { ProjectSummaryEntry } from '../state/ProjectProvider'
import { EditableText } from './EditableText'
import { ProjectSwitcher } from './ProjectSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { DownloadIcon, FilePlusIcon, UploadIcon } from './icons'

export interface AppHeaderProps {
  projectName: string
  activeProjectId: string
  savedProjects: ProjectSummaryEntry[]
  persistent: boolean
  onRenameProject: (name: string) => void
  onNewProject: () => void
  onOpenProject: (projectId: string) => void
  onDuplicateProject: (projectId: string) => void
  onDeleteProject: (entry: ProjectSummaryEntry) => void
  onExport: () => void
  onImportFile: (file: File) => void
}

const BUTTON =
  'inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

export function AppHeader({
  projectName,
  activeProjectId,
  savedProjects,
  persistent,
  onRenameProject,
  onNewProject,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onExport,
  onImportFile,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Man-Day Estimator
          </h1>

          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
              Project:
            </span>
            <EditableText
              label="Project name"
              value={projectName}
              onCommit={onRenameProject}
              className="text-base font-medium text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ProjectSwitcher
              projects={savedProjects}
              activeProjectId={activeProjectId}
              onOpen={onOpenProject}
              onDuplicate={onDuplicateProject}
              onDelete={onDeleteProject}
            />

            <button type="button" onClick={onNewProject} className={BUTTON}>
              <FilePlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={BUTTON}
            >
              <UploadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Import JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file !== undefined) onImportFile(file)
                // Reset so selecting the same file twice still fires a change.
                event.target.value = ''
              }}
            />

            <button type="button" onClick={onExport} className={BUTTON}>
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <ThemeToggle />
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {persistent
            ? 'Projects are saved in this browser. Export a JSON backup before clearing browser data, changing browsers, or moving to another device.'
            : 'Browser storage is unavailable — nothing will be saved. Export a JSON backup before closing this tab.'}
        </p>
      </div>
    </header>
  )
}
