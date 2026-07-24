/**
 * Single-project persistence, exercised through the repository.
 *
 * The app keeps exactly one project in browser storage. These cover the
 * sequences ProjectProvider performs on load, on "New Project", and on
 * import — in particular that replacing a project does not leave the old one
 * behind to be resurrected on a later load.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { calculateProjectGrandTotal } from '../domain/calculations'
import { createDefaultProject } from '../domain/factories'
import { serializeProject } from '../domain/exportProject'
import { importProjectFromText } from '../domain/validateImportedProject'
import type { ProjectData } from '../domain/types'
import {
  LocalStorageProjectRepository,
  MemoryStorage,
} from './LocalStorageProjectRepository'

function named(name: string): ProjectData {
  return { ...createDefaultProject(), name }
}

/**
 * What ProjectProvider.replaceProject does: save the new project, make it
 * active, and delete the outgoing one.
 */
async function replaceProject(
  repo: LocalStorageProjectRepository,
  previousId: string,
  next: ProjectData,
): Promise<void> {
  await repo.saveProject(next)
  await repo.setActiveProjectId(next.id)
  if (previousId !== next.id) await repo.deleteProject(previousId)
}

describe('single-project persistence', () => {
  let storage: MemoryStorage
  let repo: LocalStorageProjectRepository

  beforeEach(() => {
    storage = new MemoryStorage()
    repo = new LocalStorageProjectRepository({ storage })
  })

  it('restores the saved project on reload', async () => {
    const project = named('My RPG Game')
    await repo.saveProject(project)

    // A fresh instance stands in for a page reload.
    const reopened = new LocalStorageProjectRepository({ storage })
    const activeId = await reopened.getActiveProjectId()

    expect(activeId).toBe(project.id)
    expect((await reopened.getProject(activeId!))?.name).toBe('My RPG Game')
  })

  it('starts with nothing saved on a first visit', async () => {
    expect(await repo.getActiveProjectId()).toBeNull()
    expect(await repo.listProjects()).toEqual([])
  })

  it('keeps only one project after starting a new one', async () => {
    const first = named('First')
    await repo.saveProject(first)

    const second = createDefaultProject()
    await replaceProject(repo, first.id, second)

    const all = await repo.listProjects()
    expect(all).toHaveLength(1)
    expect(all[0]!.id).toBe(second.id)
    expect(await repo.getActiveProjectId()).toBe(second.id)
  })

  it('does not resurrect a replaced project on reload', async () => {
    const first = named('Discarded')
    await repo.saveProject(first)
    await replaceProject(repo, first.id, named('Kept'))

    const reopened = new LocalStorageProjectRepository({ storage })
    expect(await reopened.getProject(first.id)).toBeNull()
    expect(await reopened.listProjects()).toHaveLength(1)
  })

  it('replaces the project on import, keeping only the imported one', async () => {
    const current = named('Current')
    const dev = current.roles[0]!.id
    current.phases[0]!.features[0]!.tasks[0]!.estimates[dev] = 3
    await repo.saveProject(current)

    // Round-trip a file through validation, as the import dialog does.
    const incoming = named('Imported')
    const { project: imported } = importProjectFromText(
      serializeProject(incoming),
    )
    await replaceProject(repo, current.id, imported)

    const all = await repo.listProjects()
    expect(all).toHaveLength(1)
    expect(all[0]!.name).toBe('Imported')
    expect(await repo.getProject(current.id)).toBeNull()
  })

  it('handles re-importing a file exported from this same browser', async () => {
    const project = named('Same Project')
    await repo.saveProject(project)

    // The exported file carries the same ID; replacing must not delete the
    // project it just saved.
    const { project: reimported } = importProjectFromText(
      serializeProject(project),
    )
    await replaceProject(repo, project.id, reimported)

    expect(await repo.getProject(project.id)).not.toBeNull()
    expect(await repo.listProjects()).toHaveLength(1)
    expect(await repo.getActiveProjectId()).toBe(project.id)
  })

  it('preserves estimates and disabled flags across a save and reload', async () => {
    const project = createDefaultProject()
    const dev = project.roles[0]!.id
    const task = project.phases[0]!.features[0]!.tasks[0]!
    task.estimates[dev] = 2.25
    project.phases[0]!.features[0]!.enabled = false
    project.phases[0]!.note = 'Multi\nline note'

    await repo.saveProject(project)
    const restored = await repo.getProject(project.id)

    expect(restored).toEqual(project)
    // Disabled feature contributes nothing, but the value survives.
    expect(calculateProjectGrandTotal(restored!)).toBe(0)
    expect(
      restored!.phases[0]!.features[0]!.tasks[0]!.estimates[dev],
    ).toBe(2.25)
  })

  it('recovers to an empty state when stored data is corrupt', async () => {
    storage.setItem('manday-estimator-projects-v1', 'not json')

    // The provider then creates and saves a fresh default project.
    expect(await repo.getActiveProjectId()).toBeNull()
    const fresh = createDefaultProject()
    await repo.saveProject(fresh)

    expect(await repo.getActiveProjectId()).toBe(fresh.id)
    expect(await repo.listProjects()).toHaveLength(1)
  })
})
