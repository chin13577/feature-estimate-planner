/**
 * Title bar, editable project name, and the project-level actions.
 *
 * The local-storage warning sits next to Import/Export deliberately — the spec
 * asks for it near those controls, where a user is already thinking about
 * moving their data.
 */

import { useRef } from 'react'

import { EditableText } from './EditableText'
import { DownloadIcon, FilePlusIcon, UploadIcon } from './icons'

export interface AppHeaderProps {
  projectName: string
  onRenameProject: (name: string) => void
  onNewProject: () => void
  onExport: () => void
  onImportFile: (file: File) => void
}

export function AppHeader({
  projectName,
  onRenameProject,
  onNewProject,
  onExport,
  onImportFile,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buttonClass =
    'inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold text-slate-900">
            Man-Day Estimator
          </h1>

          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm text-slate-500">Project:</span>
            <EditableText
              label="Project name"
              value={projectName}
              onCommit={onRenameProject}
              className="text-base font-medium text-slate-900"
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={onNewProject} className={buttonClass}>
              <FilePlusIcon className="h-4 w-4" />
              New Project
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={buttonClass}
            >
              <UploadIcon className="h-4 w-4" />
              Import JSON
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

            <button type="button" onClick={onExport} className={buttonClass}>
              <DownloadIcon className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Projects are saved in this browser. Export a JSON backup before
          clearing browser data, changing browsers, or moving to another device.
        </p>
      </div>
    </header>
  )
}
