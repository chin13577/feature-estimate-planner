import { describe, expect, it } from 'vitest'

import { calculateProjectGrandTotal } from './calculations'
import {
  createDefaultProject,
  createId,
  duplicateFeature,
  duplicatePhase,
  duplicateProject,
  duplicateTask,
} from './factories'
import { feature, phase, project, role, task } from './testFixtures'
import { SCHEMA_VERSION } from './types'

const DEV = 'role-dev'
const ARTIST = 'role-artist'
const ROLES = [role(DEV, 'Developer'), role(ARTIST, 'Artist')]

describe('createId', () => {
  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId()))
    expect(ids.size).toBe(500)
  })
})

describe('createDefaultProject', () => {
  it('matches the spec default: 2 roles, 1 phase, 1 feature, 1 task', () => {
    const proj = createDefaultProject()

    expect(proj.schemaVersion).toBe(SCHEMA_VERSION)
    expect(proj.name).toBe('Untitled Project')
    expect(proj.roles.map((r) => r.name)).toEqual(['Developer', 'Artist'])
    expect(proj.phases).toHaveLength(1)
    expect(proj.phases[0]!.name).toBe('Phase 1')
    expect(proj.phases[0]!.features).toHaveLength(1)
    expect(proj.phases[0]!.features[0]!.name).toBe('Main Feature 1')
    expect(proj.phases[0]!.features[0]!.tasks).toHaveLength(1)
    expect(proj.phases[0]!.features[0]!.tasks[0]!.name).toBe('Task 1')
  })

  it('enables every default item', () => {
    const proj = createDefaultProject()
    const p = proj.phases[0]!
    const f = p.features[0]!

    expect(p.enabled).toBe(true)
    expect(f.enabled).toBe(true)
    expect(f.tasks[0]!.enabled).toBe(true)
  })

  it('starts with a zero total and no stored estimates', () => {
    const proj = createDefaultProject()
    expect(calculateProjectGrandTotal(proj)).toBe(0)
    expect(proj.phases[0]!.features[0]!.tasks[0]!.estimates).toEqual({})
  })

  it('creates independent projects on each call', () => {
    const a = createDefaultProject()
    const b = createDefaultProject()
    expect(a.id).not.toBe(b.id)
    expect(a.phases[0]!.id).not.toBe(b.phases[0]!.id)
  })
})

describe('duplicateTask', () => {
  it('gives the copy a new ID and a "Copy" name', () => {
    const original = task('t1', { [DEV]: 2 })
    original.name = 'Login'
    const copy = duplicateTask(original)

    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe('Login Copy')
    expect(copy.estimates).toEqual({ [DEV]: 2 })
  })

  it('copies estimates by value, not by reference', () => {
    const original = task('t1', { [DEV]: 2 })
    const copy = duplicateTask(original)

    copy.estimates[DEV] = 99
    expect(original.estimates[DEV]).toBe(2)
  })

  it('preserves the enabled flag', () => {
    expect(duplicateTask(task('t1', {}, false)).enabled).toBe(false)
  })
})

describe('duplicateFeature', () => {
  const original = feature('f1', [
    task('t1', { [DEV]: 2 }),
    task('t2', { [ARTIST]: 1 }, false),
  ])
  original.name = 'Authentication'

  it('renames only the feature, not its tasks', () => {
    const copy = duplicateFeature(original)

    expect(copy.name).toBe('Authentication Copy')
    expect(copy.tasks.map((t) => t.name)).toEqual(['t1', 't2'])
  })

  it('regenerates every task ID', () => {
    const copy = duplicateFeature(original)
    const originalIds = original.tasks.map((t) => t.id)

    expect(copy.id).not.toBe(original.id)
    for (const t of copy.tasks) {
      expect(originalIds).not.toContain(t.id)
    }
  })

  it('preserves per-task enabled flags and estimates', () => {
    const copy = duplicateFeature(original)
    expect(copy.tasks[0]!.estimates).toEqual({ [DEV]: 2 })
    expect(copy.tasks[1]!.enabled).toBe(false)
  })

  it('leaves the original untouched', () => {
    const before = JSON.stringify(original)
    duplicateFeature(original)
    expect(JSON.stringify(original)).toBe(before)
  })
})

describe('duplicatePhase', () => {
  const original = phase('p1', [
    feature('f1', [task('t1', { [DEV]: 3 })]),
    feature('f2', [task('t2', { [ARTIST]: 2 })], false),
  ])
  original.name = 'Production'
  original.note = 'Scope excludes third-party login.'

  it('copies the note and renames only the phase', () => {
    const copy = duplicatePhase(original)

    expect(copy.name).toBe('Production Copy')
    expect(copy.note).toBe('Scope excludes third-party login.')
    expect(copy.features.map((f) => f.name)).toEqual(['f1', 'f2'])
  })

  it('regenerates IDs at every depth', () => {
    const copy = duplicatePhase(original)
    const originalIds = new Set<string>([original.id])
    for (const f of original.features) {
      originalIds.add(f.id)
      for (const t of f.tasks) originalIds.add(t.id)
    }

    expect(originalIds.has(copy.id)).toBe(false)
    for (const f of copy.features) {
      expect(originalIds.has(f.id)).toBe(false)
      for (const t of f.tasks) expect(originalIds.has(t.id)).toBe(false)
    }
  })

  it('produces a copy that totals the same as the original', () => {
    const copy = duplicatePhase(original)
    const proj = project(ROLES, [original, copy])

    // Original contributes 3 (f2 is disabled), so the pair contributes 6.
    expect(calculateProjectGrandTotal(proj)).toBe(6)
  })
})

describe('duplicateProject', () => {
  const original = project(ROLES, [
    phase('p1', [feature('f1', [task('t1', { [DEV]: 4, [ARTIST]: 1 })])]),
  ])

  it('remaps estimates onto the new role IDs', () => {
    const copy = duplicateProject(original)
    const newDev = copy.roles[0]!.id
    const newArtist = copy.roles[1]!.id
    const estimates = copy.phases[0]!.features[0]!.tasks[0]!.estimates

    expect(newDev).not.toBe(DEV)
    expect(estimates[newDev]).toBe(4)
    expect(estimates[newArtist]).toBe(1)
    // No stale keys left behind.
    expect(Object.keys(estimates).sort()).toEqual([newArtist, newDev].sort())
  })

  it('totals identically to the original after remapping', () => {
    const copy = duplicateProject(original)
    expect(calculateProjectGrandTotal(copy)).toBe(
      calculateProjectGrandTotal(original),
    )
  })

  it('drops estimates whose role no longer exists', () => {
    const orphaned = project(ROLES, [
      phase('p1', [
        feature('f1', [task('t1', { [DEV]: 4, 'role-ghost': 99 })]),
      ]),
    ])
    const copy = duplicateProject(orphaned)
    const estimates = copy.phases[0]!.features[0]!.tasks[0]!.estimates

    expect(Object.keys(estimates)).toHaveLength(1)
    expect(calculateProjectGrandTotal(copy)).toBe(4)
  })

  it('accepts an explicit name and defaults to "Copy" otherwise', () => {
    expect(duplicateProject(original).name).toBe('Test Project Copy')
    expect(duplicateProject(original, 'My Fork').name).toBe('My Fork')
  })

  it('leaves the original untouched', () => {
    const before = JSON.stringify(original)
    duplicateProject(original)
    expect(JSON.stringify(original)).toBe(before)
  })
})
