/**
 * Factories for creating and duplicating domain objects.
 *
 * Every factory generates fresh IDs — names are never used as identifiers, and
 * duplication regenerates IDs at every depth so a copied phase shares nothing
 * with its original.
 */

import { SCHEMA_VERSION } from './types'
import type {
  EstimateValue,
  MainFeature,
  Phase,
  ProjectData,
  Role,
  Task,
} from './types'

/**
 * Generate a unique ID.
 *
 * `crypto.randomUUID` requires a secure context (HTTPS or localhost). The
 * fallback keeps the app working when it is served over plain HTTP on a LAN
 * address — collision risk is negligible at the scale of a single project.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Suffix applied to duplicated item names, per the spec. */
export const COPY_SUFFIX = 'Copy'

export function duplicateName(name: string): string {
  return `${name} ${COPY_SUFFIX}`
}

export function createRole(name: string): Role {
  return { id: createId(), name }
}

export function createTask(name: string): Task {
  return {
    id: createId(),
    name,
    enabled: true,
    estimates: {},
  }
}

export function createFeature(name: string): MainFeature {
  return {
    id: createId(),
    name,
    enabled: true,
    collapsed: false,
    tasks: [],
  }
}

export function createPhase(name: string): Phase {
  return {
    id: createId(),
    name,
    enabled: true,
    collapsed: false,
    note: '',
    features: [],
  }
}

/**
 * The starting project for a first-time user, per the spec's Default New
 * Project section: two roles, one phase, one feature, one task, all enabled.
 */
export function createDefaultProject(): ProjectData {
  const developer = createRole('Developer')
  const artist = createRole('Artist')

  const task = createTask('Task 1')
  const feature = createFeature('Main Feature 1')
  feature.tasks = [task]

  const phase = createPhase('Phase 1')
  phase.features = [feature]

  const timestamp = nowIso()

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name: 'Untitled Project',
    note: '',
    roles: [developer, artist],
    phases: [phase],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Copy a task's estimates. Shallow is enough — values are numbers or null. */
function cloneEstimates(
  estimates: Record<string, EstimateValue>,
): Record<string, EstimateValue> {
  return { ...estimates }
}

/**
 * Duplicate a task with a new ID and a copy of its estimates.
 * `renameCopy` is false when duplicating as part of a parent's duplication —
 * only the top-level item the user acted on gets the "Copy" suffix.
 */
export function duplicateTask(task: Task, renameCopy = true): Task {
  return {
    id: createId(),
    name: renameCopy ? duplicateName(task.name) : task.name,
    enabled: task.enabled,
    estimates: cloneEstimates(task.estimates),
  }
}

/** Duplicate a feature, regenerating IDs for it and all of its tasks. */
export function duplicateFeature(
  feature: MainFeature,
  renameCopy = true,
): MainFeature {
  return {
    id: createId(),
    name: renameCopy ? duplicateName(feature.name) : feature.name,
    enabled: feature.enabled,
    collapsed: feature.collapsed,
    note: feature.note,
    tasks: feature.tasks.map((task) => duplicateTask(task, false)),
  }
}

/** Duplicate a phase, regenerating IDs throughout and copying notes. */
export function duplicatePhase(phase: Phase, renameCopy = true): Phase {
  return {
    id: createId(),
    name: renameCopy ? duplicateName(phase.name) : phase.name,
    enabled: phase.enabled,
    collapsed: phase.collapsed,
    note: phase.note,
    features: phase.features.map((feature) => duplicateFeature(feature, false)),
  }
}

/**
 * Duplicate a whole project — used by the multi-project manager in M8.
 * Roles get new IDs too, so every task's estimate keys are remapped to match.
 */
export function duplicateProject(
  project: ProjectData,
  name = duplicateName(project.name),
): ProjectData {
  const roleIdMap = new Map<string, string>()
  const roles = project.roles.map((role) => {
    const newRole = createRole(role.name)
    newRole.burnRate = role.burnRate
    roleIdMap.set(role.id, newRole.id)
    return newRole
  })

  const remapEstimates = (
    estimates: Record<string, EstimateValue>,
  ): Record<string, EstimateValue> => {
    const remapped: Record<string, EstimateValue> = {}
    for (const [oldRoleId, value] of Object.entries(estimates)) {
      const newRoleId = roleIdMap.get(oldRoleId)
      // Drop estimates for roles that no longer exist rather than carrying
      // orphaned keys into the copy.
      if (newRoleId !== undefined) remapped[newRoleId] = value
    }
    return remapped
  }

  const timestamp = nowIso()

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    note: project.note,
    roles,
    phases: project.phases.map((phase) => ({
      id: createId(),
      name: phase.name,
      enabled: phase.enabled,
      collapsed: phase.collapsed,
      note: phase.note,
      features: phase.features.map((feature) => ({
        id: createId(),
        name: feature.name,
        enabled: feature.enabled,
        collapsed: feature.collapsed,
        note: feature.note,
        tasks: feature.tasks.map((task) => ({
          id: createId(),
          name: task.name,
          enabled: task.enabled,
          estimates: remapEstimates(task.estimates),
        })),
      })),
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
