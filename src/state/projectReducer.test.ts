import { describe, expect, it } from 'vitest'

import { calculateProjectGrandTotal } from '../domain/calculations'
import { createDefaultProject } from '../domain/factories'
import { feature, phase, project, role, task } from '../domain/testFixtures'
import type { ProjectData } from '../domain/types'
import { findFeature, findTask, projectReducer } from './projectReducer'
import type { ProjectAction } from './projectReducer'

const DEV = 'role-dev'
const ARTIST = 'role-artist'

function base(): ProjectData {
  return project(
    [role(DEV, 'Developer'), role(ARTIST, 'Artist')],
    [
      phase('p1', [
        feature('f1', [
          task('t1', { [DEV]: 2, [ARTIST]: 1 }),
          task('t2', { [DEV]: 3 }),
        ]),
        feature('f2', [task('t3', { [DEV]: 1 })]),
      ]),
      phase('p2', [feature('f3', [task('t4', { [DEV]: 4 })])]),
    ],
  )
}

/** Apply an action and assert the input was not mutated. */
function apply(state: ProjectData, action: ProjectAction): ProjectData {
  const before = JSON.stringify(state)
  const next = projectReducer(state, action)
  expect(JSON.stringify(state)).toBe(before)
  return next
}

describe('immutability', () => {
  it('never mutates state for any action', () => {
    const actions: ProjectAction[] = [
      { type: 'project/rename', name: 'New' },
      { type: 'role/add', name: 'QA' },
      { type: 'role/remove', roleId: DEV },
      { type: 'phase/add' },
      { type: 'phase/duplicate', phaseId: 'p1' },
      { type: 'phase/remove', phaseId: 'p1' },
      { type: 'feature/add', phaseId: 'p1' },
      { type: 'feature/duplicate', featureId: 'f1' },
      { type: 'task/add', featureId: 'f1' },
      { type: 'task/setEstimate', taskId: 't1', roleId: DEV, value: 9 },
      { type: 'task/duplicate', taskId: 't1' },
      { type: 'task/remove', taskId: 't1' },
    ]

    for (const action of actions) {
      apply(base(), action)
    }
  })

  it('returns the same reference when nothing changed', () => {
    const state = base()
    // Renaming to the identical name is a no-op, so autosave should not fire.
    expect(projectReducer(state, { type: 'project/rename', name: state.name })).toBe(
      state,
    )
    expect(
      projectReducer(state, { type: 'phase/remove', phaseId: 'missing' }),
    ).toBe(state)
    expect(
      projectReducer(state, { type: 'phase/move', phaseId: 'p1', direction: 'up' }),
    ).toBe(state)
  })

  it('stamps updatedAt when something changed', () => {
    const state = base()
    const next = apply(state, { type: 'project/rename', name: 'Renamed' })
    expect(next.updatedAt).not.toBe(state.updatedAt)
  })
})

describe('project actions', () => {
  it('renames the project', () => {
    expect(apply(base(), { type: 'project/rename', name: '  My Game  ' }).name).toBe(
      'My Game',
    )
  })

  it('restores the previous name when the new one is empty', () => {
    const state = base()
    expect(apply(state, { type: 'project/rename', name: '   ' }).name).toBe(
      state.name,
    )
  })

  it('sets the project note, including an empty one', () => {
    const withNote = apply(base(), { type: 'project/setNote', note: 'Hello' })
    expect(withNote.note).toBe('Hello')
    expect(apply(withNote, { type: 'project/setNote', note: '' }).note).toBe('')
  })

  it('replaces the whole project on import', () => {
    const incoming = createDefaultProject()
    const next = apply(base(), { type: 'project/replace', project: incoming })
    expect(next.id).toBe(incoming.id)
    expect(next.phases).toEqual(incoming.phases)
  })
})

describe('role actions', () => {
  it('adds a trimmed role', () => {
    const next = apply(base(), { type: 'role/add', name: '  QA  ' })
    expect(next.roles.map((r) => r.name)).toEqual(['Developer', 'Artist', 'QA'])
  })

  it('rejects an empty role name', () => {
    const state = base()
    expect(projectReducer(state, { type: 'role/add', name: '  ' })).toBe(state)
  })

  it('rejects a duplicate role name regardless of case or padding', () => {
    const state = base()
    expect(
      projectReducer(state, { type: 'role/add', name: '  developer ' }),
    ).toBe(state)
  })

  it('renames a role', () => {
    const next = apply(base(), {
      type: 'role/rename',
      roleId: DEV,
      name: 'Engineer',
    })
    expect(next.roles[0]!.name).toBe('Engineer')
  })

  it('refuses a rename that collides with another role', () => {
    const state = base()
    expect(
      projectReducer(state, { type: 'role/rename', roleId: DEV, name: 'Artist' }),
    ).toBe(state)
  })

  it('allows renaming a role to a different case of its own name', () => {
    const next = apply(base(), {
      type: 'role/rename',
      roleId: DEV,
      name: 'developer',
    })
    expect(next.roles[0]!.name).toBe('developer')
  })

  it('removes a role and purges its estimates everywhere', () => {
    const next = apply(base(), { type: 'role/remove', roleId: DEV })

    expect(next.roles.map((r) => r.id)).toEqual([ARTIST])
    for (const p of next.phases) {
      for (const f of p.features) {
        for (const t of f.tasks) {
          expect(DEV in t.estimates).toBe(false)
        }
      }
    }
    // Only the Artist estimate remains.
    expect(calculateProjectGrandTotal(next)).toBe(1)
  })

  it('reorders roles with move', () => {
    const next = apply(base(), {
      type: 'role/move',
      roleId: ARTIST,
      direction: 'up',
    })
    expect(next.roles.map((r) => r.id)).toEqual([ARTIST, DEV])
  })

  it('ignores moving the first role up or the last down', () => {
    const state = base()
    expect(
      projectReducer(state, { type: 'role/move', roleId: DEV, direction: 'up' }),
    ).toBe(state)
    expect(
      projectReducer(state, {
        type: 'role/move',
        roleId: ARTIST,
        direction: 'down',
      }),
    ).toBe(state)
  })

  it('reorders roles by index for drag-and-drop', () => {
    const next = apply(base(), { type: 'role/reorder', fromIndex: 0, toIndex: 1 })
    expect(next.roles.map((r) => r.id)).toEqual([ARTIST, DEV])
  })

  it('ignores an out-of-range reorder', () => {
    const state = base()
    expect(
      projectReducer(state, { type: 'role/reorder', fromIndex: 0, toIndex: 9 }),
    ).toBe(state)
  })
})

describe('phase actions', () => {
  it('adds a phase with a sequential default name', () => {
    const next = apply(base(), { type: 'phase/add' })
    expect(next.phases).toHaveLength(3)
    expect(next.phases[2]!.name).toBe('Phase 3')
  })

  it('renames, toggles, collapses, and notes a phase', () => {
    let state = apply(base(), {
      type: 'phase/rename',
      phaseId: 'p1',
      name: 'Pre-Production',
    })
    state = apply(state, {
      type: 'phase/setEnabled',
      phaseId: 'p1',
      enabled: false,
    })
    state = apply(state, {
      type: 'phase/setCollapsed',
      phaseId: 'p1',
      collapsed: true,
    })
    state = apply(state, { type: 'phase/setNote', phaseId: 'p1', note: 'Scope' })

    const p = state.phases[0]!
    expect(p.name).toBe('Pre-Production')
    expect(p.enabled).toBe(false)
    expect(p.collapsed).toBe(true)
    expect(p.note).toBe('Scope')
  })

  it('keeps child flags untouched when disabling a phase', () => {
    const next = apply(base(), {
      type: 'phase/setEnabled',
      phaseId: 'p1',
      enabled: false,
    })

    // Re-enabling must restore the previous configuration, so children keep
    // their own state while the parent is off.
    expect(next.phases[0]!.features[0]!.enabled).toBe(true)
    expect(next.phases[0]!.features[0]!.tasks[0]!.enabled).toBe(true)
    expect(calculateProjectGrandTotal(next)).toBe(4)
  })

  it('duplicates a phase directly after the original with new IDs', () => {
    const next = apply(base(), { type: 'phase/duplicate', phaseId: 'p1' })

    expect(next.phases.map((p) => p.name)).toEqual(['p1', 'p1 Copy', 'p2'])
    expect(next.phases[1]!.id).not.toBe('p1')
    // The copy contributes the same amount as the original.
    expect(calculateProjectGrandTotal(next)).toBe(
      calculateProjectGrandTotal(base()) + 7,
    )
  })

  it('removes a phase', () => {
    const next = apply(base(), { type: 'phase/remove', phaseId: 'p1' })
    expect(next.phases.map((p) => p.id)).toEqual(['p2'])
  })

  it('moves a phase down', () => {
    const next = apply(base(), {
      type: 'phase/move',
      phaseId: 'p1',
      direction: 'down',
    })
    expect(next.phases.map((p) => p.id)).toEqual(['p2', 'p1'])
  })
})

describe('feature actions', () => {
  it('adds a feature to the named phase only', () => {
    const next = apply(base(), { type: 'feature/add', phaseId: 'p2' })
    expect(next.phases[0]!.features).toHaveLength(2)
    expect(next.phases[1]!.features).toHaveLength(2)
    expect(next.phases[1]!.features[1]!.name).toBe('Main Feature 2')
  })

  it('ignores adding to an unknown phase', () => {
    const state = base()
    expect(projectReducer(state, { type: 'feature/add', phaseId: 'ghost' })).toBe(
      state,
    )
  })

  it('renames a feature found by ID alone', () => {
    const next = apply(base(), {
      type: 'feature/rename',
      featureId: 'f3',
      name: 'Combat',
    })
    expect(findFeature(next, 'f3')!.name).toBe('Combat')
  })

  it('disables a feature without touching its tasks', () => {
    const next = apply(base(), {
      type: 'feature/setEnabled',
      featureId: 'f1',
      enabled: false,
    })

    expect(findFeature(next, 'f1')!.enabled).toBe(false)
    expect(findFeature(next, 'f1')!.tasks[0]!.enabled).toBe(true)
    // f1 contributed 6 of the original 11.
    expect(calculateProjectGrandTotal(next)).toBe(5)
  })

  it('duplicates a feature in place with new task IDs', () => {
    const next = apply(base(), { type: 'feature/duplicate', featureId: 'f1' })
    const features = next.phases[0]!.features

    expect(features.map((f) => f.name)).toEqual(['f1', 'f1 Copy', 'f2'])
    expect(features[1]!.tasks.map((t) => t.id)).not.toContain('t1')
    expect(features[1]!.tasks[0]!.estimates[DEV]).toBe(2)
  })

  it('removes a feature', () => {
    const next = apply(base(), { type: 'feature/remove', featureId: 'f1' })
    expect(next.phases[0]!.features.map((f) => f.id)).toEqual(['f2'])
  })

  it('moves a feature within its phase', () => {
    const next = apply(base(), {
      type: 'feature/move',
      featureId: 'f2',
      direction: 'up',
    })
    expect(next.phases[0]!.features.map((f) => f.id)).toEqual(['f2', 'f1'])
  })

  it('does not move a feature across phases', () => {
    const state = base()
    // f3 is alone in p2, so moving up has nowhere to go.
    expect(
      projectReducer(state, {
        type: 'feature/move',
        featureId: 'f3',
        direction: 'up',
      }),
    ).toBe(state)
  })
})

describe('task actions', () => {
  it('adds a task with a sequential default name', () => {
    const next = apply(base(), { type: 'task/add', featureId: 'f1' })
    const tasks = findFeature(next, 'f1')!.tasks
    expect(tasks).toHaveLength(3)
    expect(tasks[2]!.name).toBe('Task 3')
    expect(tasks[2]!.estimates).toEqual({})
  })

  it('renames a task', () => {
    const next = apply(base(), {
      type: 'task/rename',
      taskId: 't1',
      name: '  Login  ',
    })
    expect(findTask(next, 't1')!.name).toBe('Login')
  })

  it('restores the previous task name when cleared', () => {
    const next = apply(base(), { type: 'task/rename', taskId: 't1', name: '' })
    expect(findTask(next, 't1')!.name).toBe('t1')
  })

  it('disables a task while keeping its estimates', () => {
    const next = apply(base(), {
      type: 'task/setEnabled',
      taskId: 't1',
      enabled: false,
    })

    expect(findTask(next, 't1')!.enabled).toBe(false)
    expect(findTask(next, 't1')!.estimates[DEV]).toBe(2)
    expect(calculateProjectGrandTotal(next)).toBe(8)
  })

  it('sets an estimate', () => {
    const next = apply(base(), {
      type: 'task/setEstimate',
      taskId: 't1',
      roleId: DEV,
      value: 5.5,
    })
    expect(findTask(next, 't1')!.estimates[DEV]).toBe(5.5)
  })

  it('clears an estimate to null for blank input', () => {
    const next = apply(base(), {
      type: 'task/setEstimate',
      taskId: 't1',
      roleId: DEV,
      value: null,
    })
    expect(findTask(next, 't1')!.estimates[DEV]).toBeNull()
    expect(calculateProjectGrandTotal(next)).toBe(9)
  })

  it('rejects negative and non-finite estimates', () => {
    const state = base()
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        projectReducer(state, {
          type: 'task/setEstimate',
          taskId: 't1',
          roleId: DEV,
          value,
        }),
      ).toBe(state)
    }
  })

  it('rejects an estimate for an unknown role', () => {
    const state = base()
    expect(
      projectReducer(state, {
        type: 'task/setEstimate',
        taskId: 't1',
        roleId: 'ghost',
        value: 3,
      }),
    ).toBe(state)
  })

  it('duplicates a task in place with a new ID and copied estimates', () => {
    const next = apply(base(), { type: 'task/duplicate', taskId: 't1' })
    const tasks = findFeature(next, 'f1')!.tasks

    expect(tasks.map((t) => t.name)).toEqual(['t1', 't1 Copy', 't2'])
    expect(tasks[1]!.id).not.toBe('t1')
    expect(tasks[1]!.estimates).toEqual({ [DEV]: 2, [ARTIST]: 1 })
  })

  it('removes a task', () => {
    const next = apply(base(), { type: 'task/remove', taskId: 't1' })
    expect(findFeature(next, 'f1')!.tasks.map((t) => t.id)).toEqual(['t2'])
    expect(calculateProjectGrandTotal(next)).toBe(8)
  })

  it('moves a task within its feature', () => {
    const next = apply(base(), {
      type: 'task/move',
      taskId: 't2',
      direction: 'up',
    })
    expect(findFeature(next, 'f1')!.tasks.map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('ignores actions on unknown tasks', () => {
    const state = base()
    expect(projectReducer(state, { type: 'task/remove', taskId: 'ghost' })).toBe(
      state,
    )
    expect(
      projectReducer(state, { type: 'task/duplicate', taskId: 'ghost' }),
    ).toBe(state)
  })
})

describe('structural sharing', () => {
  it('leaves untouched phases referentially equal', () => {
    const state = base()
    const next = projectReducer(state, {
      type: 'task/setEstimate',
      taskId: 't1',
      roleId: DEV,
      value: 9,
    })

    // p2 was not involved, so React can skip re-rendering it.
    expect(next.phases[1]).toBe(state.phases[1])
    expect(next.phases[0]).not.toBe(state.phases[0])
  })

  it('leaves sibling features referentially equal', () => {
    const state = base()
    const next = projectReducer(state, {
      type: 'task/setEnabled',
      taskId: 't1',
      enabled: false,
    })

    expect(next.phases[0]!.features[1]).toBe(state.phases[0]!.features[1])
  })
})

describe('integration with the default project', () => {
  it('supports a full editing session', () => {
    let state = createDefaultProject()
    const [dev] = state.roles
    const phaseId = state.phases[0]!.id
    const featureId = state.phases[0]!.features[0]!.id
    const taskId = state.phases[0]!.features[0]!.tasks[0]!.id

    state = apply(state, { type: 'project/rename', name: 'My RPG Game' })
    state = apply(state, {
      type: 'task/setEstimate',
      taskId,
      roleId: dev!.id,
      value: 2,
    })
    state = apply(state, { type: 'task/add', featureId })
    state = apply(state, { type: 'feature/add', phaseId })
    state = apply(state, { type: 'phase/add' })

    expect(state.name).toBe('My RPG Game')
    expect(state.phases).toHaveLength(2)
    expect(state.phases[0]!.features).toHaveLength(2)
    expect(calculateProjectGrandTotal(state)).toBe(2)
  })
})
