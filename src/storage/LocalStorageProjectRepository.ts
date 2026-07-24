/**
 * Local-storage implementation of {@link ProjectRepository}.
 *
 * The spec requires this to survive corrupted storage without crashing. The
 * strategy: validate everything on read, quarantine anything unreadable under
 * a backup key so the user's data is not silently destroyed, and degrade to an
 * empty index rather than throwing on the startup path.
 */

import { validateImportedProject } from '../domain/validateImportedProject'
import type { ProjectData } from '../domain/types'
import { StorageError } from './ProjectRepository'
import type { LocalProjectIndex, ProjectRepository } from './ProjectRepository'

export const STORAGE_KEY = 'manday-estimator-projects-v1'

/** Where unreadable data is moved so a reset is never a silent data loss. */
export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}-corrupt-backup`

/**
 * The subset of the Storage API this repository uses.
 * Narrowing it keeps the class testable without a DOM.
 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Reported when stored data could not be read and was quarantined. */
export interface CorruptionReport {
  message: string
  backupKey: string
}

export interface LocalStorageRepositoryOptions {
  storage?: StorageLike
  /** Called when stored data is quarantined, so the UI can warn the user. */
  onCorruption?: (report: CorruptionReport) => void
}

function emptyIndex(): LocalProjectIndex {
  return { activeProjectId: null, projects: {} }
}

/**
 * An in-memory stand-in used when `localStorage` is unavailable — Safari
 * private mode and some embedded browsers throw on access. The app stays
 * usable for the session; the UI warns that nothing will persist.
 */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}

/**
 * Probe for a usable `localStorage`.
 *
 * Merely reading `window.localStorage` can throw when cookies are blocked, and
 * Safari private mode historically allowed reads but threw on write — so this
 * performs a real round trip rather than a presence check.
 */
export function detectStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    if (typeof localStorage === 'undefined') {
      return { storage: new MemoryStorage(), persistent: false }
    }
    const probe = `${STORAGE_KEY}-probe`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return { storage: localStorage, persistent: true }
  } catch {
    return { storage: new MemoryStorage(), persistent: false }
  }
}

export class LocalStorageProjectRepository implements ProjectRepository {
  private readonly storage: StorageLike
  private readonly onCorruption: (report: CorruptionReport) => void

  constructor(options: LocalStorageRepositoryOptions = {}) {
    this.storage = options.storage ?? detectStorage().storage
    this.onCorruption = options.onCorruption ?? (() => {})
  }

  /**
   * Read and validate the whole index.
   *
   * Never throws: startup must not enter a crash loop because of bad stored
   * data. Anything unreadable is quarantined and an empty index returned, so
   * the app opens on a fresh default project instead of a blank error screen.
   */
  private readIndex(): LocalProjectIndex {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch {
      return emptyIndex()
    }

    if (raw === null) return emptyIndex()

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.quarantine(raw, 'Saved projects could not be read (invalid JSON).')
      return emptyIndex()
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.quarantine(raw, 'Saved projects were in an unexpected format.')
      return emptyIndex()
    }

    const candidate = parsed as Partial<LocalProjectIndex>
    const rawProjects = candidate.projects

    if (
      rawProjects === null ||
      typeof rawProjects !== 'object' ||
      Array.isArray(rawProjects)
    ) {
      this.quarantine(raw, 'Saved projects were in an unexpected format.')
      return emptyIndex()
    }

    // Validate each project independently: one bad project should not cost the
    // user every other project they have saved.
    const projects: Record<string, ProjectData> = {}
    let skipped = 0

    for (const [id, value] of Object.entries(rawProjects)) {
      try {
        projects[id] = validateImportedProject(value)
      } catch {
        skipped += 1
      }
    }

    if (skipped > 0) {
      this.quarantine(
        raw,
        skipped === 1
          ? '1 saved project could not be read and was skipped.'
          : `${skipped} saved projects could not be read and were skipped.`,
      )
    }

    const activeProjectId =
      typeof candidate.activeProjectId === 'string' &&
      candidate.activeProjectId in projects
        ? candidate.activeProjectId
        : null

    return { activeProjectId, projects }
  }

  /** Copy unreadable data aside, then report it. Best effort — never throws. */
  private quarantine(raw: string, message: string): void {
    try {
      this.storage.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      // A full quota is not a reason to fail the read path.
    }
    this.onCorruption({ message, backupKey: CORRUPT_BACKUP_KEY })
  }

  private writeIndex(index: LocalProjectIndex): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(index))
    } catch (error) {
      // Quota is the realistic failure here, and it is worth surfacing: the
      // user's latest edits did not persist.
      throw new StorageError(
        'Could not save to browser storage. It may be full — export a JSON backup.',
        error,
      )
    }
  }

  async listProjects(): Promise<ProjectData[]> {
    const { projects } = this.readIndex()
    return Object.values(projects).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  }

  async getProject(projectId: string): Promise<ProjectData | null> {
    return this.readIndex().projects[projectId] ?? null
  }

  async saveProject(project: ProjectData): Promise<void> {
    const index = this.readIndex()
    index.projects[project.id] = project
    // First save of a project makes it active, so a fresh install opens it.
    if (index.activeProjectId === null) {
      index.activeProjectId = project.id
    }
    this.writeIndex(index)
  }

  async deleteProject(projectId: string): Promise<void> {
    const index = this.readIndex()
    delete index.projects[projectId]

    if (index.activeProjectId === projectId) {
      // Fall back to whatever remains so the app never points at nothing.
      const [next] = Object.keys(index.projects)
      index.activeProjectId = next ?? null
    }

    this.writeIndex(index)
  }

  async getActiveProjectId(): Promise<string | null> {
    return this.readIndex().activeProjectId
  }

  async setActiveProjectId(projectId: string | null): Promise<void> {
    const index = this.readIndex()
    index.activeProjectId =
      projectId !== null && projectId in index.projects ? projectId : null
    this.writeIndex(index)
  }

  /** Discard everything, including any quarantined backup. */
  async clearAll(): Promise<void> {
    try {
      this.storage.removeItem(STORAGE_KEY)
      this.storage.removeItem(CORRUPT_BACKUP_KEY)
    } catch (error) {
      throw new StorageError('Could not clear browser storage.', error)
    }
  }
}
