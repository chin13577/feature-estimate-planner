/**
 * Multi-project flows exercised through the repository.
 *
 * These cover the sequences ProjectProvider performs when switching, copying,
 * deleting, and adopting projects — the logic that decides which project is
 * active afterwards.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { calculateProjectGrandTotal } from '../domain/calculations'
import { createDefaultProject, duplicateProject } from '../domain/factories'
import type { ProjectData } from '../domain/types'
import {
  LocalStorageProjectRepository,
  MemoryStorage,
} from './LocalStorageProjectRepository'

function named(name: string): ProjectData {
  return { ...createDefaultProject(), name }
}

describe('multi-project flows', () => {
  let storage: MemoryStorage
  let repo: LocalStorageProjectRepository

  beforeEach(() => {
    storage = new MemoryStorage()
    repo = new LocalStorageProjectRepository({ storage })
  })

  it('keeps several projects side by side', async () => {
    const a = named('Alpha')
    const b = named('Beta')

    await repo.saveProject(a)
    await repo.saveProject(b)

    const all = await repo.listProjects()
    expect(all.map((p) => p.name).sort()).toEqual(['Alpha', 'Beta'])
  })

  it('switches the active project and restores it on reload', async () => {
    const a = named('Alpha')
    const b = named('Beta')
    await repo.saveProject(a)
    await repo.saveProject(b)
    await repo.setActiveProjectId(b.id)

    // A fresh instance stands in for a page reload.
    const reopened = new LocalStorageProjectRepository({ storage })
    const activeId = await reopened.getActiveProjectId()
    expect(activeId).toBe(b.id)
    expect((await reopened.getProject(activeId!))?.name).toBe('Beta')
  })

  it('does not lose edits made before switching away', async () => {
    const a = named('Alpha')
    await repo.saveProject(a)

    // Provider flushes the open project before switching.
    const edited = { ...a, name: 'Alpha Edited' }
    await repo.saveProject(edited)

    const b = named('Beta')
    await repo.saveProject(b)
    await repo.setActiveProjectId(b.id)

    expect((await repo.getProject(a.id))?.name).toBe('Alpha Edited')
  })

  it('duplicates a project as an independent copy', async () => {
    const original = named('Alpha')
    const dev = original.roles[0]!.id
    original.phases[0]!.features[0]!.tasks[0]!.estimates[dev] = 4

    await repo.saveProject(original)

    const copy = duplicateProject(original)
    await repo.saveProject(copy)
    await repo.setActiveProjectId(copy.id)

    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe('Alpha Copy')
    expect(calculateProjectGrandTotal(copy)).toBe(4)

    // Editing the copy must not touch the original.
    const edited = { ...copy, name: 'Renamed Copy' }
    await repo.saveProject(edited)
    expect((await repo.getProject(original.id))?.name).toBe('Alpha')
    expect(await repo.listProjects()).toHaveLength(2)
  })

  it('falls back to another project when the active one is deleted', async () => {
    const a = named('Alpha')
    const b = named('Beta')
    await repo.saveProject(a)
    await repo.saveProject(b)
    await repo.setActiveProjectId(a.id)

    await repo.deleteProject(a.id)

    expect(await repo.getActiveProjectId()).toBe(b.id)
    expect(await repo.listProjects()).toHaveLength(1)
  })

  it('leaves no active project when the last one is deleted', async () => {
    const a = named('Alpha')
    await repo.saveProject(a)
    await repo.deleteProject(a.id)

    // The provider then creates and activates a fresh default project.
    expect(await repo.getActiveProjectId()).toBeNull()
    expect(await repo.listProjects()).toEqual([])
  })

  it('adopts an imported project alongside the existing ones', async () => {
    const existing = named('Alpha')
    await repo.saveProject(existing)

    const imported = named('Imported')
    await repo.saveProject(imported)
    await repo.setActiveProjectId(imported.id)

    expect(await repo.listProjects()).toHaveLength(2)
    expect(await repo.getActiveProjectId()).toBe(imported.id)
    // The pre-existing project is untouched.
    expect((await repo.getProject(existing.id))?.name).toBe('Alpha')
  })

  it('re-keys an import that collides with a saved project ID', async () => {
    const existing = named('Alpha')
    await repo.saveProject(existing)

    // A file exported from this same browser carries the same ID; adopting it
    // verbatim would overwrite rather than add.
    const collidingImport: ProjectData = { ...named('Alpha Backup'), id: existing.id }
    const rekeyed = { ...collidingImport, id: 'fresh-id' }

    await repo.saveProject(rekeyed)

    const all = await repo.listProjects()
    expect(all).toHaveLength(2)
    expect(all.map((p) => p.name).sort()).toEqual(['Alpha', 'Alpha Backup'])
  })
})
