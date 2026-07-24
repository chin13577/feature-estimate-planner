/**
 * Pure calculation utilities.
 *
 * Every total in the application is derived here. Nothing in this module reads
 * or writes React state, mutates its arguments, or caches results — totals are
 * always recomputed from the source data, per the spec's rule that derived
 * totals are never stored.
 *
 * The governing rule: a task contributes to a total only when its phase, its
 * feature, and the task itself are all enabled.
 */

import type {
  EstimateValue,
  MainFeature,
  Phase,
  ProjectData,
  Role,
  Task,
} from './types'

/**
 * Floating-point man-days accumulate error: 0.1 + 0.2 === 0.30000000000000004.
 * Estimates are entered in 0.25 steps, so rounding to 4 decimal places is far
 * finer than any value a user can type while still absorbing binary drift.
 */
const PRECISION = 4

function roundToPrecision(value: number): number {
  const factor = 10 ** PRECISION
  return Math.round(value * factor) / factor
}

/**
 * Coerce a stored estimate to a number for arithmetic.
 *
 * Blank (`null`) counts as 0. Values that survived validation are always finite
 * and non-negative, but this stays defensive: local storage can be edited by
 * hand, so a `NaN` or `Infinity` that slips through degrades to 0 rather than
 * poisoning every total above it.
 */
export function estimateToNumber(value: EstimateValue | undefined): number {
  if (value === null || value === undefined) return 0
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  return value
}

/**
 * A task counts toward totals only when the whole chain above it is enabled.
 * This is the single rule every calculation below defers to.
 */
export function isTaskEffectivelyEnabled(
  phase: Phase,
  feature: MainFeature,
  task: Task,
): boolean {
  return phase.enabled && feature.enabled && task.enabled
}

/** Sum of one role's estimates across a feature's enabled tasks. */
export function calculateFeatureRoleTotal(
  phase: Phase,
  feature: MainFeature,
  roleId: string,
): number {
  let total = 0
  for (const task of feature.tasks) {
    if (!isTaskEffectivelyEnabled(phase, feature, task)) continue
    total += estimateToNumber(task.estimates[roleId])
  }
  return roundToPrecision(total)
}

/** Sum of a feature's per-role totals across every role. */
export function calculateFeatureGrandTotal(
  phase: Phase,
  feature: MainFeature,
  roles: Role[],
): number {
  let total = 0
  for (const role of roles) {
    total += calculateFeatureRoleTotal(phase, feature, role.id)
  }
  return roundToPrecision(total)
}

/** Sum of one role's estimates across a phase's enabled features. */
export function calculatePhaseRoleTotal(phase: Phase, roleId: string): number {
  let total = 0
  for (const feature of phase.features) {
    total += calculateFeatureRoleTotal(phase, feature, roleId)
  }
  return roundToPrecision(total)
}

/** Sum of a phase's per-role totals across every role. */
export function calculatePhaseGrandTotal(phase: Phase, roles: Role[]): number {
  let total = 0
  for (const role of roles) {
    total += calculatePhaseRoleTotal(phase, role.id)
  }
  return roundToPrecision(total)
}

/** Sum of one role's estimates across every enabled phase. */
export function calculateProjectRoleTotal(
  project: ProjectData,
  roleId: string,
): number {
  let total = 0
  for (const phase of project.phases) {
    total += calculatePhaseRoleTotal(phase, roleId)
  }
  return roundToPrecision(total)
}

/** Sum of the project's per-role totals across every role. */
export function calculateProjectGrandTotal(project: ProjectData): number {
  let total = 0
  for (const role of project.roles) {
    total += calculateProjectRoleTotal(project, role.id)
  }
  return roundToPrecision(total)
}

/**
 * Total a phase *would* contribute if every item in it were enabled.
 *
 * The project summary uses this to show a disabled phase's saved estimates
 * alongside its calculated 0, so users can see what re-enabling would add.
 * Unlike the functions above, this deliberately ignores every enabled flag.
 */
export function calculateRawPhaseRoleTotal(phase: Phase, roleId: string): number {
  let total = 0
  for (const feature of phase.features) {
    for (const task of feature.tasks) {
      total += estimateToNumber(task.estimates[roleId])
    }
  }
  return roundToPrecision(total)
}

/** Raw counterpart to {@link calculatePhaseGrandTotal}, ignoring enabled flags. */
export function calculateRawPhaseGrandTotal(
  phase: Phase,
  roles: Role[],
): number {
  let total = 0
  for (const role of roles) {
    total += calculateRawPhaseRoleTotal(phase, role.id)
  }
  return roundToPrecision(total)
}

/**
 * Per-role totals for a whole project in one pass, keyed by role ID.
 *
 * The summary table needs every role total at once; calling
 * `calculateProjectRoleTotal` per role re-walks the phase tree each time.
 */
export function calculateProjectRoleTotals(
  project: ProjectData,
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const role of project.roles) {
    totals[role.id] = calculateProjectRoleTotal(project, role.id)
  }
  return totals
}

/** A role's burn rate, defaulting to 1 and never zero/negative. */
export function roleBurnRate(role: Role): number {
  const rate = role.burnRate
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return 1
  return rate
}

/**
 * Elapsed working days a role needs for a given man-day total, given its burn
 * rate (people working in parallel). Man-days ÷ burn rate.
 */
export function calculateRoleDays(mandays: number, role: Role): number {
  return roundToPrecision(mandays / roleBurnRate(role))
}

/**
 * The project's timeline in working days: the longest single-role track, since
 * roles work in parallel. Only enabled work counts, matching every other total.
 */
export function calculateProjectTimelineDays(project: ProjectData): number {
  let max = 0
  for (const role of project.roles) {
    const days = calculateRoleDays(
      calculateProjectRoleTotal(project, role.id),
      role,
    )
    if (days > max) max = days
  }
  return roundToPrecision(max)
}

/** Count of tasks under a feature — used by delete confirmation messages. */
export function countTasksInFeature(feature: MainFeature): number {
  return feature.tasks.length
}

/** Count of tasks under a phase — used by delete confirmation messages. */
export function countTasksInPhase(phase: Phase): number {
  let count = 0
  for (const feature of phase.features) {
    count += feature.tasks.length
  }
  return count
}

/**
 * Whether any task anywhere in the project has a non-blank estimate for a role.
 * Gates the "this role already contains estimates" delete confirmation.
 */
export function roleHasEstimates(project: ProjectData, roleId: string): boolean {
  for (const phase of project.phases) {
    for (const feature of phase.features) {
      for (const task of feature.tasks) {
        const value = task.estimates[roleId]
        if (value !== null && value !== undefined && value !== 0) return true
      }
    }
  }
  return false
}
