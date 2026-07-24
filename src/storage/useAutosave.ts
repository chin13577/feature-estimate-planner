/**
 * Debounced autosave.
 *
 * The spec asks for a 300–500 ms debounce so that typing in a name field or
 * dragging through estimate values does not write to storage on every
 * keystroke.
 */

import { useEffect, useRef } from 'react'

import type { ProjectData } from '../domain/types'
import type { ProjectRepository } from './ProjectRepository'

export const AUTOSAVE_DELAY_MS = 400

export interface UseAutosaveOptions {
  project: ProjectData | null
  repository: ProjectRepository
  /** Skip saving while the initial project is still loading. */
  enabled?: boolean
  onError?: (error: unknown) => void
}

export function useAutosave({
  project,
  repository,
  enabled = true,
  onError,
}: UseAutosaveOptions): void {
  // Held in refs so a changing callback identity does not restart the timer.
  const repositoryRef = useRef(repository)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    repositoryRef.current = repository
    onErrorRef.current = onError
  }, [repository, onError])

  useEffect(() => {
    if (!enabled || project === null) return

    const timer = setTimeout(() => {
      void repositoryRef.current.saveProject(project).catch((error: unknown) => {
        onErrorRef.current?.(error)
      })
    }, AUTOSAVE_DELAY_MS)

    // A newer edit supersedes the pending write rather than queueing behind it.
    return () => clearTimeout(timer)
  }, [project, enabled])
}
