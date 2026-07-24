import { describe, expect, it } from 'vitest'

import {
  calculateFeatureGrandTotal,
  calculateFeatureRoleTotal,
  calculatePhaseGrandTotal,
  calculatePhaseRoleTotal,
  calculateProjectGrandTotal,
  calculateProjectRoleTotal,
  calculateProjectRoleTotals,
  calculateRawPhaseGrandTotal,
  countTasksInFeature,
  countTasksInPhase,
  estimateToNumber,
  isTaskEffectivelyEnabled,
  roleHasEstimates,
} from './calculations'
import { feature, phase, project, role, task } from './testFixtures'

const DEV = 'role-dev'
const ARTIST = 'role-artist'
const QA = 'role-qa'
const ROLES = [role(DEV, 'Developer'), role(ARTIST, 'Artist'), role(QA, 'QA')]

/**
 * The six cases the spec calls out by name. Each mirrors its section of the
 * spec's "Calculation Test Cases" exactly.
 */
describe('spec calculation test cases', () => {
  it('Test 1: sums every role when all items are enabled', () => {
    const f = feature('f1', [
      task('a', { [DEV]: 2, [ARTIST]: 1 }),
      task('b', { [DEV]: 3, [ARTIST]: 2 }),
    ])
    const p = phase('p1', [f])

    expect(calculateFeatureRoleTotal(p, f, DEV)).toBe(5)
    expect(calculateFeatureRoleTotal(p, f, ARTIST)).toBe(3)
    expect(calculateFeatureGrandTotal(p, f, ROLES)).toBe(8)
  })

  it('Test 2: excludes a disabled task but keeps its value', () => {
    const disabled = task('b', { [DEV]: 5 }, false)
    const f = feature('f1', [task('a', { [DEV]: 2 }), disabled])
    const p = phase('p1', [f])

    expect(calculateFeatureRoleTotal(p, f, DEV)).toBe(2)
    // The estimate survives in the data — disabling must never delete values.
    expect(disabled.estimates[DEV]).toBe(5)
  })

  it('Test 3: excludes a disabled feature from the phase total', () => {
    const enabled = feature('fa', [task('a', { [DEV]: 4 })])
    const disabled = feature('fb', [task('b', { [DEV]: 10 })], false)
    const p = phase('p1', [enabled, disabled])

    expect(calculatePhaseRoleTotal(p, DEV)).toBe(4)
    // The disabled feature's own total is 0 while it is off.
    expect(calculateFeatureRoleTotal(p, disabled, DEV)).toBe(0)
  })

  it('Test 4: excludes a disabled phase from the project total', () => {
    const enabled = phase('pa', [feature('fa', [task('a', { [DEV]: 15 })])])
    const disabled = phase(
      'pb',
      [feature('fb', [task('b', { [DEV]: 30 })])],
      false,
    )
    const proj = project(ROLES, [enabled, disabled])

    expect(calculateProjectGrandTotal(proj)).toBe(15)
    // ...but the phase's saved estimates are still there to be shown.
    expect(calculateRawPhaseGrandTotal(disabled, ROLES)).toBe(30)
  })

  it('Test 5: re-enabling a parent restores its contribution', () => {
    const t = task('a', { [DEV]: 5 })
    const f = feature('fa', [t])
    const disabledPhase = phase('pa', [f], false)
    const proj = project(ROLES, [disabledPhase])

    expect(calculateProjectGrandTotal(proj)).toBe(0)

    // Re-enable, without touching any child flag.
    const enabledPhase = { ...disabledPhase, enabled: true }
    const reEnabled = project(ROLES, [enabledPhase])

    expect(calculateProjectGrandTotal(reEnabled)).toBe(5)
  })

  it('Test 6: treats blank as 0 and sums decimals', () => {
    const f = feature('f1', [task('a', { [DEV]: null, [ARTIST]: 1.5 })])
    const p = phase('p1', [f])

    expect(calculateFeatureRoleTotal(p, f, DEV)).toBe(0)
    expect(calculateFeatureRoleTotal(p, f, ARTIST)).toBe(1.5)
    expect(calculateFeatureGrandTotal(p, f, ROLES)).toBe(1.5)
  })
})

describe('isTaskEffectivelyEnabled', () => {
  const t = task('a', {})

  it('is true only when phase, feature, and task all agree', () => {
    expect(isTaskEffectivelyEnabled(phase('p', []), feature('f', []), t)).toBe(
      true,
    )
  })

  it('is false when any ancestor is disabled', () => {
    const f = feature('f', [])
    const p = phase('p', [])

    expect(isTaskEffectivelyEnabled({ ...p, enabled: false }, f, t)).toBe(false)
    expect(isTaskEffectivelyEnabled(p, { ...f, enabled: false }, t)).toBe(false)
    expect(isTaskEffectivelyEnabled(p, f, { ...t, enabled: false })).toBe(false)
  })
})

describe('estimateToNumber', () => {
  it('treats blank and missing as 0', () => {
    expect(estimateToNumber(null)).toBe(0)
    expect(estimateToNumber(undefined)).toBe(0)
  })

  it('passes through valid values including 0', () => {
    expect(estimateToNumber(0)).toBe(0)
    expect(estimateToNumber(2.25)).toBe(2.25)
  })

  it('degrades corrupt values to 0 rather than poisoning totals', () => {
    expect(estimateToNumber(Number.NaN)).toBe(0)
    expect(estimateToNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(estimateToNumber(-5)).toBe(0)
  })
})

describe('floating point behaviour', () => {
  it('sums 0.25 steps without binary drift', () => {
    const f = feature('f1', [
      task('a', { [DEV]: 0.1 }),
      task('b', { [DEV]: 0.2 }),
    ])
    const p = phase('p1', [f])

    // Naive summation would give 0.30000000000000004.
    expect(calculateFeatureRoleTotal(p, f, DEV)).toBe(0.3)
  })

  it('keeps quarter-day totals exact across many tasks', () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      task(`t${i}`, { [DEV]: 0.25 }),
    )
    const f = feature('f1', tasks)
    const p = phase('p1', [f])

    expect(calculateFeatureRoleTotal(p, f, DEV)).toBe(3)
  })
})

describe('aggregation across the tree', () => {
  const proj = project(ROLES, [
    phase('pre', [
      feature('auth', [
        task('login', { [DEV]: 2, [ARTIST]: 2, [QA]: null }),
        task('login-ui', { [DEV]: null, [ARTIST]: 1, [QA]: null }),
        task('old-login', { [DEV]: 4, [ARTIST]: 2, [QA]: 1 }, false),
      ]),
    ]),
    phase('prototype', [feature('proto', [task('spike', { [DEV]: 8 })])], false),
  ])

  // This is the spec's own worked example screen.
  it('matches the spec example: Dev 2, Artist 3, QA 0, total 5', () => {
    expect(calculateProjectRoleTotal(proj, DEV)).toBe(2)
    expect(calculateProjectRoleTotal(proj, ARTIST)).toBe(3)
    expect(calculateProjectRoleTotal(proj, QA)).toBe(0)
    expect(calculateProjectGrandTotal(proj)).toBe(5)
  })

  it('computes all role totals in one pass identically', () => {
    expect(calculateProjectRoleTotals(proj)).toEqual({
      [DEV]: 2,
      [ARTIST]: 3,
      [QA]: 0,
    })
  })

  it('reports a disabled phase as 0 but exposes its raw total', () => {
    const prototype = proj.phases[1]!
    expect(calculatePhaseGrandTotal(prototype, ROLES)).toBe(0)
    expect(calculateRawPhaseGrandTotal(prototype, ROLES)).toBe(8)
  })

  it('never mutates the project while calculating', () => {
    const before = JSON.stringify(proj)
    calculateProjectGrandTotal(proj)
    calculateProjectRoleTotals(proj)
    expect(JSON.stringify(proj)).toBe(before)
  })
})

describe('edge cases', () => {
  it('returns 0 for a project with no phases', () => {
    expect(calculateProjectGrandTotal(project(ROLES, []))).toBe(0)
  })

  it('returns 0 for a project with no roles', () => {
    const proj = project(
      [],
      [phase('p', [feature('f', [task('t', { [DEV]: 5 })])])],
    )
    // With no roles there are no columns to sum, even though data exists.
    expect(calculateProjectGrandTotal(proj)).toBe(0)
  })

  it('ignores estimates whose role ID is unknown', () => {
    const f = feature('f', [task('t', { [DEV]: 2, 'role-ghost': 99 })])
    const p = phase('p', [f])
    expect(calculateFeatureGrandTotal(p, f, ROLES)).toBe(2)
  })

  it('handles a feature with no tasks', () => {
    const f = feature('empty', [])
    expect(calculateFeatureRoleTotal(phase('p', [f]), f, DEV)).toBe(0)
  })
})

describe('helpers for confirmation dialogs', () => {
  const f = feature('f', [task('a', {}), task('b', {}), task('c', {})])
  const p = phase('p', [f, feature('g', [task('d', {})])])

  it('counts tasks for delete messages', () => {
    expect(countTasksInFeature(f)).toBe(3)
    expect(countTasksInPhase(p)).toBe(4)
  })

  it('detects whether a role holds estimates anywhere', () => {
    const withData = project(ROLES, [
      phase('p', [feature('f', [task('t', { [DEV]: 3, [ARTIST]: null })])]),
    ])

    expect(roleHasEstimates(withData, DEV)).toBe(true)
    expect(roleHasEstimates(withData, ARTIST)).toBe(false)
    expect(roleHasEstimates(withData, QA)).toBe(false)
  })

  it('does not count a zero or blank estimate as data', () => {
    const zeroed = project(ROLES, [
      phase('p', [feature('f', [task('t', { [DEV]: 0 })])]),
    ])
    expect(roleHasEstimates(zeroed, DEV)).toBe(false)
  })

  it('counts estimates inside disabled items', () => {
    // Disabled does not mean empty — deleting the role would still lose data.
    const hidden = project(ROLES, [
      phase('p', [feature('f', [task('t', { [DEV]: 3 }, false)], false)], false),
    ])
    expect(roleHasEstimates(hidden, DEV)).toBe(true)
  })
})
