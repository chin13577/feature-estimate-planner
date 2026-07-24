/**
 * Domain types for the Man-Day Estimator.
 *
 * These mirror the JSON data model exactly — what is serialised to disk and to
 * local storage is what is defined here. Derived totals are never stored; they
 * are computed on demand by `calculations.ts`.
 */

/** Current schema version. Imported files must match this. */
export const SCHEMA_VERSION = 1

/**
 * A single man-day estimate for one task and one role.
 * `null` means "blank" — the user has not entered a value. Blank counts as 0
 * in every calculation but stays distinct from an explicit 0 in the data so
 * the UI can render it as `-`.
 */
export type EstimateValue = number | null

export interface Role {
  id: string
  name: string
  /**
   * Man-days this role can complete per working day — i.e. how many people
   * work in parallel on it. Dividing a role's total man-days by its burn rate
   * gives the elapsed working days that role needs. Absent means 1.
   */
  burnRate?: number
}

export interface Task {
  id: string
  name: string
  enabled: boolean
  /** Keyed by role ID — never by role name. */
  estimates: Record<string, EstimateValue>
}

export interface MainFeature {
  id: string
  name: string
  enabled: boolean
  collapsed: boolean
  /** Free-text description shown beneath the feature. Absent means blank. */
  note?: string
  tasks: Task[]
}

export interface Phase {
  id: string
  name: string
  enabled: boolean
  collapsed: boolean
  note: string
  features: MainFeature[]
}

export interface ProjectData {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  note: string
  roles: Role[]
  phases: Phase[]
  /** ISO 8601 timestamp. */
  createdAt: string
  /** ISO 8601 timestamp. */
  updatedAt: string
  /** ISO 8601 timestamp, present only on exported files. */
  exportedAt?: string
}
