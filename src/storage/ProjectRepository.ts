/**
 * Persistence contract.
 *
 * React components and the state layer talk to this interface, never to
 * `localStorage` directly. A future `FirestoreProjectRepository` can be
 * substituted without touching calculations, domain types, or UI.
 *
 * Every method is async even though the local-storage implementation is
 * synchronous: a cloud implementation will not be, and callers written against
 * a synchronous contract would all need rewriting later.
 */

import type { ProjectData } from '../domain/types'

export interface ProjectRepository {
  /** Every saved project, ordered by most recently updated first. */
  listProjects(): Promise<ProjectData[]>

  getProject(projectId: string): Promise<ProjectData | null>

  saveProject(project: ProjectData): Promise<void>

  deleteProject(projectId: string): Promise<void>

  /** ID of the project to open on startup, or null when none is chosen. */
  getActiveProjectId(): Promise<string | null>

  setActiveProjectId(projectId: string | null): Promise<void>
}

/**
 * Shape stored under the local-storage key, per the spec's suggestion.
 * Projects are keyed by ID so lookup does not scan an array.
 */
export interface LocalProjectIndex {
  activeProjectId: string | null
  projects: Record<string, ProjectData>
}

/** Raised when persistence fails in a way the user should be told about. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}
