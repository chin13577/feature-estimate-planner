/**
 * Import validation.
 *
 * The rule that governs this module: never partially import. Either the whole
 * file is accepted and returned as a clean `ProjectData`, or a
 * `ProjectValidationError` is thrown and application state is left untouched.
 *
 * Error messages are user-facing and match the wording the spec specifies.
 */

import { z } from 'zod'

import { projectDataSchema } from './schema'
import { SCHEMA_VERSION } from './types'
import type { EstimateValue, ProjectData } from './types'

/** Leading line the UI shows above any import failure. */
export const IMPORT_ERROR_HEADING = 'Unable to import the file.'

/**
 * A validation failure with a message safe to show the user.
 *
 * `warnings` carries non-fatal repairs made during a *successful* import — it
 * is unused on the error path but keeps the result shape consistent.
 */
export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectValidationError'
  }
}

export interface ValidationResult {
  project: ProjectData
  /** Non-fatal repairs, e.g. estimates dropped for unknown roles. */
  warnings: string[]
}

/**
 * Turn a zod issue into something a non-technical user can act on.
 *
 * Zod's own messages name paths like `phases.0.features.1.enabled`, which is
 * accurate but opaque; the spec asks for wording like
 * "Missing required field: phases."
 */
function describeIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.')

  if (issue.code === 'invalid_type') {
    if (issue.received === 'undefined') {
      return `Missing required field: ${path || 'project'}.`
    }
    return `Field "${path}" must be ${issue.expected}, but found ${issue.received}.`
  }

  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Check the schema version before anything else.
 *
 * A version mismatch deserves its own message — telling a user their v3 file
 * has "invalid field: phases" would send them hunting for the wrong problem.
 */
function assertSchemaVersion(value: Record<string, unknown>): void {
  const version = value['schemaVersion']

  if (version === undefined) {
    throw new ProjectValidationError('Missing required field: schemaVersion.')
  }

  if (version !== SCHEMA_VERSION) {
    throw new ProjectValidationError(`Unsupported schema version: ${String(version)}.`)
  }
}

/** Reject duplicate IDs within one collection — IDs are how items are addressed. */
function assertUniqueIds(
  ids: string[],
  label: string,
): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      throw new ProjectValidationError(`Duplicate ${label} ID: ${id}.`)
    }
    seen.add(id)
  }
}

/** Role names must be unique after trimming, per the spec. */
function assertUniqueRoleNames(names: string[]): void {
  const seen = new Set<string>()
  for (const name of names) {
    const key = name.trim().toLowerCase()
    if (seen.has(key)) {
      throw new ProjectValidationError(`Duplicate role name: ${name.trim()}.`)
    }
    seen.add(key)
  }
}

/**
 * Parse a JSON string, or fail with the spec's exact wording.
 * Kept separate from structural validation so a syntax error is not reported
 * as a missing field.
 */
export function parseProjectJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProjectValidationError('The selected file is not valid JSON.')
  }
}

/**
 * Validate an unknown value and return a clean project.
 *
 * Fatal problems throw. Recoverable ones — estimates pointing at roles that
 * do not exist — are repaired and reported through `warnings`, which is what
 * the spec permits ("removed or reported").
 */
export function validateImportedProjectDetailed(
  value: unknown,
): ValidationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectValidationError(
      'The file does not contain a project object.',
    )
  }

  assertSchemaVersion(value as Record<string, unknown>)

  const parsed = projectDataSchema.safeParse(value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ProjectValidationError(
      first ? describeIssue(first) : 'The file structure is not valid.',
    )
  }

  const data = parsed.data
  const warnings: string[] = []

  assertUniqueIds(
    data.roles.map((role) => role.id),
    'role',
  )
  assertUniqueRoleNames(data.roles.map((role) => role.name))
  assertUniqueIds(
    data.phases.map((phase) => phase.id),
    'phase',
  )

  const knownRoleIds = new Set(data.roles.map((role) => role.id))
  let droppedEstimates = 0

  // Feature and task IDs must be unique globally, not just among siblings:
  // the reducer addresses them by ID alone when applying edits.
  const featureIds: string[] = []
  const taskIds: string[] = []

  const phases = data.phases.map((phase) => ({
    ...phase,
    features: phase.features.map((feature) => {
      featureIds.push(feature.id)
      return {
        ...feature,
        tasks: feature.tasks.map((task) => {
          taskIds.push(task.id)

          const estimates: Record<string, EstimateValue> = {}
          for (const [roleId, estimate] of Object.entries(task.estimates)) {
            if (knownRoleIds.has(roleId)) {
              estimates[roleId] = estimate
            } else {
              droppedEstimates += 1
            }
          }

          return { ...task, estimates }
        }),
      }
    }),
  }))

  assertUniqueIds(featureIds, 'feature')
  assertUniqueIds(taskIds, 'task')

  if (droppedEstimates > 0) {
    warnings.push(
      droppedEstimates === 1
        ? '1 estimate referenced a role that does not exist and was removed.'
        : `${droppedEstimates} estimates referenced roles that do not exist and were removed.`,
    )
  }

  const project: ProjectData = {
    schemaVersion: SCHEMA_VERSION,
    id: data.id,
    name: data.name,
    note: data.note,
    roles: data.roles,
    phases,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(data.exportedAt === undefined ? {} : { exportedAt: data.exportedAt }),
  }

  return { project, warnings }
}

/**
 * Convenience wrapper matching the signature the spec suggests.
 * Discards warnings; use the detailed form when they should be surfaced.
 */
export function validateImportedProject(value: unknown): ProjectData {
  return validateImportedProjectDetailed(value).project
}

/** Parse and validate a file's text in one step. */
export function importProjectFromText(text: string): ValidationResult {
  return validateImportedProjectDetailed(parseProjectJson(text))
}
