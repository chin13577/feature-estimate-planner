/**
 * Import a project from a `.json` file.
 *
 * Validation errors are shown inside the dialog rather than as a toast, so
 * the file picker stays open and the user can retry without reopening
 * anything. Nothing is applied to application state until the preview is
 * confirmed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  countTasksInPhase,
  calculateProjectGrandTotal,
} from '../domain/calculations'
import type { ProjectData } from '../domain/types'
import {
  IMPORT_ERROR_HEADING,
  ProjectValidationError,
  importProjectFromText,
} from '../domain/validateImportedProject'
import { Modal } from './Modal'
import { formatNumber, pluralize } from './formatting'
import { UploadIcon } from './icons'

export interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (project: ProjectData, warnings: string[]) => void
}

interface Preview {
  project: ProjectData
  warnings: string[]
  filename: string
}

export function ImportDialog({ open, onClose, onConfirm }: ImportDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset between openings so a previous error or preview never carries over.
  useEffect(() => {
    if (!open) {
      setError(null)
      setPreview(null)
      setDragging(false)
    }
  }, [open])

  const readFile = useCallback(async (file: File) => {
    setError(null)
    setPreview(null)

    // Accept by extension as well as MIME type: some systems report
    // application/octet-stream for .json files.
    const looksJson =
      file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')

    if (!looksJson) {
      setError('Only .json files can be imported.')
      return
    }

    try {
      const text = await file.text()
      const { project, warnings } = importProjectFromText(text)
      setPreview({ project, warnings, filename: file.name })
    } catch (caught) {
      setError(
        caught instanceof ProjectValidationError
          ? caught.message
          : 'The file could not be read.',
      )
    }
  }, [])

  const taskCount =
    preview === null
      ? 0
      : preview.project.phases.reduce(
          (total, phase) => total + countTasksInPhase(phase),
          0,
        )

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="import-dialog-title"
      className="max-w-lg"
    >
      <h2
        id="import-dialog-title"
        className="text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        Import project
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Choose a <code>.json</code> file exported from this app. Importing
        replaces the project you are working on — export a backup first if you
        want to keep it.
      </p>

      {preview === null ? (
        <>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files[0]
              if (file !== undefined) void readFile(file)
            }}
            className={`mt-4 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging
                ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <UploadIcon className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Drag a file here, or
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Choose a file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Project JSON file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file !== undefined) void readFile(file)
                // Reset so re-picking the same file still fires a change.
                event.target.value = ''
              }}
            />
          </div>

          {error !== null && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/50"
            >
              <p className="font-medium text-red-900 dark:text-red-200">
                {IMPORT_ERROR_HEADING}
              </p>
              <p className="mt-0.5 text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {preview.filename}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {preview.project.name}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex gap-1">
              <dt>Phases:</dt>
              <dd className="tabular-nums">{preview.project.phases.length}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Tasks:</dt>
              <dd className="tabular-nums">{taskCount}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Roles:</dt>
              <dd className="tabular-nums">{preview.project.roles.length}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Total:</dt>
              <dd className="tabular-nums">
                {formatNumber(calculateProjectGrandTotal(preview.project))} md
              </dd>
            </div>
          </dl>

          {preview.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm text-amber-700 dark:text-amber-300">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={preview === null ? onClose : () => setPreview(null)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {preview === null ? 'Cancel' : 'Choose another file'}
        </button>
        <button
          type="button"
          disabled={preview === null}
          onClick={() => {
            if (preview !== null) onConfirm(preview.project, preview.warnings)
          }}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900"
        >
          {preview === null
            ? 'Import'
            : `Import ${pluralize(preview.project.phases.length, 'phase')}`}
        </button>
      </div>
    </Modal>
  )
}
