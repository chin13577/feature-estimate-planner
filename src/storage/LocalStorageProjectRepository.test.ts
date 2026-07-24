import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultProject } from '../domain/factories'
import { serializeProject } from '../domain/exportProject'
import type { ProjectData } from '../domain/types'
import {
  CORRUPT_BACKUP_KEY,
  LocalStorageProjectRepository,
  MemoryStorage,
  STORAGE_KEY,
} from './LocalStorageProjectRepository'
import { StorageError } from './ProjectRepository'
import type { CorruptionReport } from './LocalStorageProjectRepository'

/** A project with a controllable ID and updated timestamp. */
function makeProject(id: string, updatedAt: string): ProjectData {
  return { ...createDefaultProject(), id, updatedAt }
}

describe('LocalStorageProjectRepository', () => {
  let storage: MemoryStorage
  let repo: LocalStorageProjectRepository
  let corruption: CorruptionReport[]

  beforeEach(() => {
    storage = new MemoryStorage()
    corruption = []
    repo = new LocalStorageProjectRepository({
      storage,
      onCorruption: (report) => corruption.push(report),
    })
  })

  describe('CRUD', () => {
    it('returns an empty list when nothing is stored', async () => {
      expect(await repo.listProjects()).toEqual([])
      expect(await repo.getActiveProjectId()).toBeNull()
    })

    it('saves and reads back a project', async () => {
      const project = makeProject('p1', '2026-01-01T00:00:00.000Z')
      await repo.saveProject(project)

      expect(await repo.getProject('p1')).toEqual(project)
    })

    it('returns null for an unknown project', async () => {
      expect(await repo.getProject('missing')).toBeNull()
    })

    it('overwrites an existing project on re-save', async () => {
      const project = makeProject('p1', '2026-01-01T00:00:00.000Z')
      await repo.saveProject(project)
      await repo.saveProject({ ...project, name: 'Renamed' })

      expect((await repo.getProject('p1'))?.name).toBe('Renamed')
      expect(await repo.listProjects()).toHaveLength(1)
    })

    it('lists projects most recently updated first', async () => {
      await repo.saveProject(makeProject('old', '2026-01-01T00:00:00.000Z'))
      await repo.saveProject(makeProject('new', '2026-06-01T00:00:00.000Z'))
      await repo.saveProject(makeProject('mid', '2026-03-01T00:00:00.000Z'))

      expect((await repo.listProjects()).map((p) => p.id)).toEqual([
        'new',
        'mid',
        'old',
      ])
    })

    it('deletes a project', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.deleteProject('p1')

      expect(await repo.getProject('p1')).toBeNull()
      expect(await repo.listProjects()).toEqual([])
    })

    it('ignores deletion of an unknown project', async () => {
      await expect(repo.deleteProject('missing')).resolves.toBeUndefined()
    })
  })

  describe('active project', () => {
    it('makes the first saved project active', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      expect(await repo.getActiveProjectId()).toBe('p1')
    })

    it('does not steal active status from an existing project', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.saveProject(makeProject('p2', '2026-02-01T00:00:00.000Z'))

      expect(await repo.getActiveProjectId()).toBe('p1')
    })

    it('switches the active project', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.saveProject(makeProject('p2', '2026-02-01T00:00:00.000Z'))
      await repo.setActiveProjectId('p2')

      expect(await repo.getActiveProjectId()).toBe('p2')
    })

    it('refuses to activate a project that does not exist', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.setActiveProjectId('ghost')

      expect(await repo.getActiveProjectId()).toBeNull()
    })

    it('falls back to a remaining project when the active one is deleted', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.saveProject(makeProject('p2', '2026-02-01T00:00:00.000Z'))
      await repo.deleteProject('p1')

      expect(await repo.getActiveProjectId()).toBe('p2')
    })

    it('clears the active project when the last one is deleted', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))
      await repo.deleteProject('p1')

      expect(await repo.getActiveProjectId()).toBeNull()
    })
  })

  describe('corruption recovery', () => {
    it('recovers from unparseable JSON without throwing', async () => {
      storage.setItem(STORAGE_KEY, '{ not json at all')

      expect(await repo.listProjects()).toEqual([])
      expect(corruption).toHaveLength(1)
      expect(corruption[0]!.message).toContain('invalid JSON')
    })

    it('quarantines the raw data rather than discarding it', async () => {
      const raw = '{ not json at all'
      storage.setItem(STORAGE_KEY, raw)
      await repo.listProjects()

      expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBe(raw)
    })

    it('recovers when the stored value is an array', async () => {
      storage.setItem(STORAGE_KEY, '[]')

      expect(await repo.listProjects()).toEqual([])
      expect(corruption).toHaveLength(1)
    })

    it('recovers when projects is not an object', async () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeProjectId: null, projects: 'nope' }),
      )

      expect(await repo.listProjects()).toEqual([])
      expect(corruption).toHaveLength(1)
    })

    it('keeps valid projects when one is invalid', async () => {
      const good = makeProject('good', '2026-01-01T00:00:00.000Z')
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeProjectId: 'good',
          projects: {
            good: JSON.parse(serializeProject(good)),
            bad: { schemaVersion: 99, id: 'bad' },
          },
        }),
      )

      const projects = await repo.listProjects()
      expect(projects.map((p) => p.id)).toEqual(['good'])
      expect(corruption[0]!.message).toContain('1 saved project')
    })

    it('never enters a crash loop on repeated reads', async () => {
      storage.setItem(STORAGE_KEY, 'garbage')

      await expect(repo.listProjects()).resolves.toEqual([])
      await expect(repo.listProjects()).resolves.toEqual([])
      await expect(repo.getProject('anything')).resolves.toBeNull()
      await expect(repo.getActiveProjectId()).resolves.toBeNull()
    })

    it('lets a save succeed after corrupted data is cleared', async () => {
      storage.setItem(STORAGE_KEY, 'garbage')
      await repo.listProjects()

      const project = makeProject('p1', '2026-01-01T00:00:00.000Z')
      await repo.saveProject(project)

      expect(await repo.getProject('p1')).toEqual(project)
    })

    it('drops an active ID pointing at a project that is gone', async () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeProjectId: 'ghost', projects: {} }),
      )

      expect(await repo.getActiveProjectId()).toBeNull()
    })
  })

  describe('storage failures', () => {
    it('reports a quota failure as a StorageError', async () => {
      const failing = new MemoryStorage()
      vi.spyOn(failing, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      const failingRepo = new LocalStorageProjectRepository({
        storage: failing,
      })

      await expect(
        failingRepo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z')),
      ).rejects.toBeInstanceOf(StorageError)
    })

    it('mentions exporting a backup in the quota message', async () => {
      const failing = new MemoryStorage()
      vi.spyOn(failing, 'setItem').mockImplementation(() => {
        throw new Error('full')
      })
      const failingRepo = new LocalStorageProjectRepository({
        storage: failing,
      })

      await expect(
        failingRepo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z')),
      ).rejects.toThrowError(/export a JSON backup/i)
    })

    it('treats a throwing getItem as empty rather than failing', async () => {
      const failing = new MemoryStorage()
      vi.spyOn(failing, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      const failingRepo = new LocalStorageProjectRepository({
        storage: failing,
      })

      await expect(failingRepo.listProjects()).resolves.toEqual([])
    })
  })

  describe('persistence across instances', () => {
    it('reads data written by a different repository instance', async () => {
      await repo.saveProject(makeProject('p1', '2026-01-01T00:00:00.000Z'))

      const reopened = new LocalStorageProjectRepository({ storage })
      expect((await reopened.getProject('p1'))?.id).toBe('p1')
      expect(await reopened.getActiveProjectId()).toBe('p1')
    })

    it('round-trips a project without losing estimates or flags', async () => {
      const project = createDefaultProject()
      const task = project.phases[0]!.features[0]!.tasks[0]!
      task.estimates[project.roles[0]!.id] = 2.25
      task.enabled = false
      project.phases[0]!.note = 'Multi\nline'

      await repo.saveProject(project)
      const restored = await repo.getProject(project.id)

      expect(restored).toEqual(project)
    })
  })

  describe('clearAll', () => {
    it('removes both the index and any quarantined backup', async () => {
      storage.setItem(STORAGE_KEY, 'garbage')
      await repo.listProjects()
      await repo.clearAll()

      expect(storage.getItem(STORAGE_KEY)).toBeNull()
      expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBeNull()
    })
  })
})
