/**
 * Immutable project reducer.
 *
 * Every mutation the UI can perform lives here as a pure function of
 * (state, action). Nothing mutates its input: each action rebuilds only the
 * path it touches and shares the rest structurally.
 *
 * Items are addressed by ID at every level, never by index or name.
 */

import {
  createFeature,
  createPhase,
  createRole,
  createTask,
  duplicateFeature,
  duplicatePhase,
  duplicateTask,
} from '../domain/factories'
import type {
  EstimateValue,
  MainFeature,
  Phase,
  ProjectData,
  Role,
  Task,
} from '../domain/types'

export type ProjectAction =
  // Project
  | { type: 'project/rename'; name: string }
  | { type: 'project/setNote'; note: string }
  | { type: 'project/replace'; project: ProjectData }
  // Roles
  | { type: 'role/add'; name: string }
  | { type: 'role/rename'; roleId: string; name: string }
  | { type: 'role/setBurnRate'; roleId: string; burnRate: number }
  | { type: 'role/move'; roleId: string; direction: 'up' | 'down' }
  | { type: 'role/reorder'; fromIndex: number; toIndex: number }
  | { type: 'role/remove'; roleId: string }
  // Phases
  | { type: 'phase/add'; name?: string }
  | { type: 'phase/rename'; phaseId: string; name: string }
  | { type: 'phase/setEnabled'; phaseId: string; enabled: boolean }
  | { type: 'phase/setCollapsed'; phaseId: string; collapsed: boolean }
  | { type: 'phase/setNote'; phaseId: string; note: string }
  | { type: 'phase/duplicate'; phaseId: string }
  | { type: 'phase/remove'; phaseId: string }
  | { type: 'phase/move'; phaseId: string; direction: 'up' | 'down' }
  | { type: 'phase/reorder'; fromIndex: number; toIndex: number }
  // Features
  | { type: 'feature/add'; phaseId: string; name?: string }
  | { type: 'feature/rename'; featureId: string; name: string }
  | { type: 'feature/setEnabled'; featureId: string; enabled: boolean }
  | { type: 'feature/setNote'; featureId: string; note: string }
  | { type: 'feature/setCollapsed'; featureId: string; collapsed: boolean }
  | { type: 'feature/duplicate'; featureId: string }
  | { type: 'feature/remove'; featureId: string }
  | { type: 'feature/move'; featureId: string; direction: 'up' | 'down' }
  // Tasks
  | { type: 'task/add'; featureId: string; name?: string }
  | { type: 'task/rename'; taskId: string; name: string }
  | { type: 'task/setEnabled'; taskId: string; enabled: boolean }
  | {
      type: 'task/setEstimate'
      taskId: string
      roleId: string
      value: EstimateValue
    }
  | { type: 'task/duplicate'; taskId: string }
  | { type: 'task/remove'; taskId: string }
  | { type: 'task/move'; taskId: string; direction: 'up' | 'down' }

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Move an item within an array, returning a new array.
 * Out-of-range moves return the original array so callers can rely on
 * reference equality to detect "nothing happened".
 */
function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) return items
  next.splice(toIndex, 0, moved)
  return next
}

function moveById<T extends { id: string }>(
  items: T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return items
  return moveItem(items, index, direction === 'up' ? index - 1 : index + 1)
}

/**
 * Apply a rename, rejecting names that are empty after trimming.
 * Returning the previous name matches the spec's rule that an empty edit
 * restores what was there before rather than clearing the field.
 */
function resolveName(next: string, previous: string): string {
  const trimmed = next.trim()
  return trimmed.length > 0 ? trimmed : previous
}

/** Map over phases, rebuilding only the one that matches. */
function mapPhase(
  project: ProjectData,
  phaseId: string,
  fn: (phase: Phase) => Phase,
): Phase[] {
  return project.phases.map((phase) => (phase.id === phaseId ? fn(phase) : phase))
}

/**
 * Map over every feature in the project, rebuilding only the match.
 * Features are addressed by their own ID without naming a parent phase, which
 * is why M2 enforces globally unique feature IDs.
 */
function mapFeature(
  project: ProjectData,
  featureId: string,
  fn: (feature: MainFeature) => MainFeature,
): Phase[] {
  return project.phases.map((phase) => {
    if (!phase.features.some((feature) => feature.id === featureId)) {
      return phase
    }
    return {
      ...phase,
      features: phase.features.map((feature) =>
        feature.id === featureId ? fn(feature) : feature,
      ),
    }
  })
}

/** Map over every task in the project, rebuilding only the match. */
function mapTask(
  project: ProjectData,
  taskId: string,
  fn: (task: Task) => Task,
): Phase[] {
  return project.phases.map((phase) => {
    let phaseChanged = false

    const features = phase.features.map((feature) => {
      if (!feature.tasks.some((task) => task.id === taskId)) return feature
      phaseChanged = true
      return {
        ...feature,
        tasks: feature.tasks.map((task) => (task.id === taskId ? fn(task) : task)),
      }
    })

    return phaseChanged ? { ...phase, features } : phase
  })
}

/** Rebuild the feature that owns a task, e.g. to insert or remove one. */
function mapFeatureOwningTask(
  project: ProjectData,
  taskId: string,
  fn: (feature: MainFeature) => MainFeature,
): Phase[] {
  return project.phases.map((phase) => {
    let phaseChanged = false

    const features = phase.features.map((feature) => {
      if (!feature.tasks.some((task) => task.id === taskId)) return feature
      phaseChanged = true
      return fn(feature)
    })

    return phaseChanged ? { ...phase, features } : phase
  })
}

/** Next default name in a sequence, e.g. "Phase 3" when two exist. */
function nextDefaultName(prefix: string, count: number): string {
  return `${prefix} ${count + 1}`
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

/**
 * Apply an action, stamping `updatedAt` whenever anything changed.
 *
 * Actions that turn out to be no-ops (renaming to the same name, moving the
 * first item up) return the original state by reference, so autosave and React
 * re-renders are not triggered by nothing.
 */
export function projectReducer(
  state: ProjectData,
  action: ProjectAction,
): ProjectData {
  const next = applyAction(state, action)
  if (next === state) return state
  return { ...next, updatedAt: new Date().toISOString() }
}

function applyAction(
  state: ProjectData,
  action: ProjectAction,
): ProjectData {
  switch (action.type) {
    /* ---------------- Project ---------------- */

    case 'project/rename': {
      const name = resolveName(action.name, state.name)
      if (name === state.name) return state
      return { ...state, name }
    }

    case 'project/setNote': {
      if (action.note === state.note) return state
      return { ...state, note: action.note }
    }

    case 'project/replace':
      // Import and "new project" both land here. The incoming project is
      // already validated; it replaces state wholesale.
      return action.project

    /* ---------------- Roles ---------------- */

    case 'role/add': {
      const name = action.name.trim()
      if (name.length === 0) return state
      // Role names are unique after trimming, case-insensitively.
      const exists = state.roles.some(
        (role) => role.name.trim().toLowerCase() === name.toLowerCase(),
      )
      if (exists) return state
      return { ...state, roles: [...state.roles, createRole(name)] }
    }

    case 'role/rename': {
      const target = state.roles.find((role) => role.id === action.roleId)
      if (target === undefined) return state

      const name = resolveName(action.name, target.name)
      if (name === target.name) return state

      const clashes = state.roles.some(
        (role) =>
          role.id !== action.roleId &&
          role.name.trim().toLowerCase() === name.toLowerCase(),
      )
      if (clashes) return state

      return {
        ...state,
        roles: state.roles.map((role) =>
          role.id === action.roleId ? { ...role, name } : role,
        ),
      }
    }

    case 'role/setBurnRate': {
      const target = state.roles.find((role) => role.id === action.roleId)
      if (target === undefined) return state

      // A burn rate is people-in-parallel; zero or negative is meaningless and
      // would divide totals to infinity, so those are ignored.
      if (!Number.isFinite(action.burnRate) || action.burnRate <= 0) return state
      if (target.burnRate === action.burnRate) return state

      return {
        ...state,
        roles: state.roles.map((role) =>
          role.id === action.roleId
            ? { ...role, burnRate: action.burnRate }
            : role,
        ),
      }
    }

    case 'role/move': {
      const roles = moveById(state.roles, action.roleId, action.direction)
      if (roles === state.roles) return state
      return { ...state, roles }
    }

    case 'role/reorder': {
      const roles = moveItem(state.roles, action.fromIndex, action.toIndex)
      if (roles === state.roles) return state
      return { ...state, roles }
    }

    case 'role/remove': {
      if (!state.roles.some((role) => role.id === action.roleId)) return state

      // Removing a role must remove its estimates everywhere, per the spec —
      // leaving them would resurrect stale numbers if the role were re-added
      // with the same ID.
      const phases = state.phases.map((phase) => ({
        ...phase,
        features: phase.features.map((feature) => ({
          ...feature,
          tasks: feature.tasks.map((task) => {
            if (!(action.roleId in task.estimates)) return task
            const estimates = { ...task.estimates }
            delete estimates[action.roleId]
            return { ...task, estimates }
          }),
        })),
      }))

      return {
        ...state,
        roles: state.roles.filter((role) => role.id !== action.roleId),
        phases,
      }
    }

    /* ---------------- Phases ---------------- */

    case 'phase/add': {
      const name =
        action.name?.trim() ?? nextDefaultName('Phase', state.phases.length)
      return { ...state, phases: [...state.phases, createPhase(name)] }
    }

    case 'phase/rename': {
      const target = state.phases.find((phase) => phase.id === action.phaseId)
      if (target === undefined) return state

      const name = resolveName(action.name, target.name)
      if (name === target.name) return state

      return {
        ...state,
        phases: mapPhase(state, action.phaseId, (phase) => ({ ...phase, name })),
      }
    }

    case 'phase/setEnabled': {
      const target = state.phases.find((phase) => phase.id === action.phaseId)
      if (target === undefined || target.enabled === action.enabled) return state

      // Child flags are deliberately untouched: re-enabling restores the
      // previous configuration rather than turning everything on.
      return {
        ...state,
        phases: mapPhase(state, action.phaseId, (phase) => ({
          ...phase,
          enabled: action.enabled,
        })),
      }
    }

    case 'phase/setCollapsed': {
      const target = state.phases.find((phase) => phase.id === action.phaseId)
      if (target === undefined || target.collapsed === action.collapsed) {
        return state
      }
      return {
        ...state,
        phases: mapPhase(state, action.phaseId, (phase) => ({
          ...phase,
          collapsed: action.collapsed,
        })),
      }
    }

    case 'phase/setNote': {
      const target = state.phases.find((phase) => phase.id === action.phaseId)
      if (target === undefined || target.note === action.note) return state
      return {
        ...state,
        phases: mapPhase(state, action.phaseId, (phase) => ({
          ...phase,
          note: action.note,
        })),
      }
    }

    case 'phase/duplicate': {
      const index = state.phases.findIndex(
        (phase) => phase.id === action.phaseId,
      )
      if (index === -1) return state

      const original = state.phases[index]!
      const phases = [...state.phases]
      // Insert directly after the original so the copy is easy to find.
      phases.splice(index + 1, 0, duplicatePhase(original))
      return { ...state, phases }
    }

    case 'phase/remove': {
      if (!state.phases.some((phase) => phase.id === action.phaseId)) {
        return state
      }
      return {
        ...state,
        phases: state.phases.filter((phase) => phase.id !== action.phaseId),
      }
    }

    case 'phase/move': {
      const phases = moveById(state.phases, action.phaseId, action.direction)
      if (phases === state.phases) return state
      return { ...state, phases }
    }

    case 'phase/reorder': {
      const phases = moveItem(state.phases, action.fromIndex, action.toIndex)
      if (phases === state.phases) return state
      return { ...state, phases }
    }

    /* ---------------- Features ---------------- */

    case 'feature/add': {
      const phase = state.phases.find((p) => p.id === action.phaseId)
      if (phase === undefined) return state

      const name =
        action.name?.trim() ??
        nextDefaultName('Main Feature', phase.features.length)

      return {
        ...state,
        phases: mapPhase(state, action.phaseId, (p) => ({
          ...p,
          features: [...p.features, createFeature(name)],
        })),
      }
    }

    case 'feature/rename': {
      const target = findFeature(state, action.featureId)
      if (target === undefined) return state

      const name = resolveName(action.name, target.name)
      if (name === target.name) return state

      return {
        ...state,
        phases: mapFeature(state, action.featureId, (feature) => ({
          ...feature,
          name,
        })),
      }
    }

    case 'feature/setEnabled': {
      const target = findFeature(state, action.featureId)
      if (target === undefined || target.enabled === action.enabled) return state
      return {
        ...state,
        phases: mapFeature(state, action.featureId, (feature) => ({
          ...feature,
          enabled: action.enabled,
        })),
      }
    }

    case 'feature/setNote': {
      const target = findFeature(state, action.featureId)
      if (target === undefined || (target.note ?? '') === action.note) {
        return state
      }
      return {
        ...state,
        phases: mapFeature(state, action.featureId, (feature) => ({
          ...feature,
          note: action.note,
        })),
      }
    }

    case 'feature/setCollapsed': {
      const target = findFeature(state, action.featureId)
      if (target === undefined || target.collapsed === action.collapsed) {
        return state
      }
      return {
        ...state,
        phases: mapFeature(state, action.featureId, (feature) => ({
          ...feature,
          collapsed: action.collapsed,
        })),
      }
    }

    case 'feature/duplicate': {
      let changed = false
      const phases = state.phases.map((phase) => {
        const index = phase.features.findIndex((f) => f.id === action.featureId)
        if (index === -1) return phase

        changed = true
        const features = [...phase.features]
        features.splice(index + 1, 0, duplicateFeature(phase.features[index]!))
        return { ...phase, features }
      })

      return changed ? { ...state, phases } : state
    }

    case 'feature/remove': {
      if (findFeature(state, action.featureId) === undefined) return state
      return {
        ...state,
        phases: state.phases.map((phase) =>
          phase.features.some((f) => f.id === action.featureId)
            ? {
                ...phase,
                features: phase.features.filter(
                  (f) => f.id !== action.featureId,
                ),
              }
            : phase,
        ),
      }
    }

    case 'feature/move': {
      let changed = false
      const phases = state.phases.map((phase) => {
        const features = moveById(
          phase.features,
          action.featureId,
          action.direction,
        )
        if (features === phase.features) return phase
        changed = true
        return { ...phase, features }
      })

      return changed ? { ...state, phases } : state
    }

    /* ---------------- Tasks ---------------- */

    case 'task/add': {
      const feature = findFeature(state, action.featureId)
      if (feature === undefined) return state

      const name =
        action.name?.trim() ?? nextDefaultName('Task', feature.tasks.length)

      return {
        ...state,
        phases: mapFeature(state, action.featureId, (f) => ({
          ...f,
          tasks: [...f.tasks, createTask(name)],
        })),
      }
    }

    case 'task/rename': {
      const target = findTask(state, action.taskId)
      if (target === undefined) return state

      const name = resolveName(action.name, target.name)
      if (name === target.name) return state

      return {
        ...state,
        phases: mapTask(state, action.taskId, (task) => ({ ...task, name })),
      }
    }

    case 'task/setEnabled': {
      const target = findTask(state, action.taskId)
      if (target === undefined || target.enabled === action.enabled) return state

      // Estimates are untouched — disabling never deletes data.
      return {
        ...state,
        phases: mapTask(state, action.taskId, (task) => ({
          ...task,
          enabled: action.enabled,
        })),
      }
    }

    case 'task/setEstimate': {
      const target = findTask(state, action.taskId)
      if (target === undefined) return state
      if (!state.roles.some((role) => role.id === action.roleId)) return state

      // Reject values that would poison totals; the input layer should prevent
      // these, but a paste or a stale keystroke can still produce them.
      if (
        action.value !== null &&
        (!Number.isFinite(action.value) || action.value < 0)
      ) {
        return state
      }

      if (target.estimates[action.roleId] === action.value) return state

      return {
        ...state,
        phases: mapTask(state, action.taskId, (task) => ({
          ...task,
          estimates: { ...task.estimates, [action.roleId]: action.value },
        })),
      }
    }

    case 'task/duplicate': {
      let changed = false
      const phases = mapFeatureOwningTask(state, action.taskId, (feature) => {
        const index = feature.tasks.findIndex((t) => t.id === action.taskId)
        if (index === -1) return feature

        changed = true
        const tasks = [...feature.tasks]
        tasks.splice(index + 1, 0, duplicateTask(feature.tasks[index]!))
        return { ...feature, tasks }
      })

      return changed ? { ...state, phases } : state
    }

    case 'task/remove': {
      if (findTask(state, action.taskId) === undefined) return state
      return {
        ...state,
        phases: mapFeatureOwningTask(state, action.taskId, (feature) => ({
          ...feature,
          tasks: feature.tasks.filter((task) => task.id !== action.taskId),
        })),
      }
    }

    case 'task/move': {
      let changed = false
      const phases = state.phases.map((phase) => {
        let phaseChanged = false

        const features = phase.features.map((feature) => {
          const tasks = moveById(feature.tasks, action.taskId, action.direction)
          if (tasks === feature.tasks) return feature
          phaseChanged = true
          return { ...feature, tasks }
        })

        if (!phaseChanged) return phase
        changed = true
        return { ...phase, features }
      })

      return changed ? { ...state, phases } : state
    }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function findFeature(
  project: ProjectData,
  featureId: string,
): MainFeature | undefined {
  for (const phase of project.phases) {
    const feature = phase.features.find((f) => f.id === featureId)
    if (feature !== undefined) return feature
  }
  return undefined
}

export function findTask(
  project: ProjectData,
  taskId: string,
): Task | undefined {
  for (const phase of project.phases) {
    for (const feature of phase.features) {
      const task = feature.tasks.find((t) => t.id === taskId)
      if (task !== undefined) return task
    }
  }
  return undefined
}

export function findPhaseOfFeature(
  project: ProjectData,
  featureId: string,
): Phase | undefined {
  return project.phases.find((phase) =>
    phase.features.some((feature) => feature.id === featureId),
  )
}

export function findRole(
  project: ProjectData,
  roleId: string,
): Role | undefined {
  return project.roles.find((role) => role.id === roleId)
}
