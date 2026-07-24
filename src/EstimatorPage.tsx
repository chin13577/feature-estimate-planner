/**
 * The estimator screen: header, roles, phases, summary, and their dialogs.
 *
 * This owns the confirmation flow — components below it report *intent*
 * ("delete this feature") and this decides whether a confirmation is needed
 * and what it should say.
 */

import { useCallback, useMemo, useState } from 'react'

import { AppHeader } from './components/AppHeader'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ImportDialog } from './components/ImportDialog'
import { PhaseCard } from './components/PhaseCard'
import { ProjectSummary } from './components/ProjectSummary'
import { RoleManager } from './components/RoleManager'
import { Toasts } from './components/Toasts'
import { pluralize } from './components/formatting'
import { PlusIcon } from './components/icons'
import {
  countTasksInFeature,
  countTasksInPhase,
  roleHasEstimates,
} from './domain/calculations'
import { exportProjectAsJson } from './domain/exportProject'
import { createDefaultProject } from './domain/factories'
import type {
  MainFeature,
  Phase,
  ProjectData,
  Role,
  Task,
} from './domain/types'
import { useProject } from './state/ProjectProvider'

/** A destructive action awaiting confirmation. */
interface PendingConfirm {
  title: string
  description?: string
  confirmLabel: string
  tone: 'danger' | 'default'
  onConfirm: () => void
}

export function EstimatorPage() {
  const {
    project,
    dispatch,
    ready,
    persistent,
    replaceProject,
    notices,
    notify,
    dismissNotice,
  } = useProject()

  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const closeConfirm = useCallback(() => setPending(null), [])

  const confirmAnd = useCallback(
    (confirm: Omit<PendingConfirm, 'onConfirm'>, action: () => void) => {
      setPending({
        ...confirm,
        onConfirm: () => {
          action()
          setPending(null)
        },
      })
    },
    [],
  )

  /* ---------------- Project-level actions ---------------- */

  const handleNewProject = useCallback(() => {
    // Only one project is kept, so starting a new one discards the current
    // work. That warrants a confirmation.
    confirmAnd(
      {
        title: 'Start a new project?',
        description:
          'This replaces the project you are working on. Export a JSON backup first if you want to keep it.',
        confirmLabel: 'New Project',
        tone: 'danger',
      },
      () => {
        void replaceProject(createDefaultProject())
      },
    )
  }, [confirmAnd, replaceProject])

  const handleExport = useCallback(() => {
    try {
      exportProjectAsJson(project)
      notify({ tone: 'success', message: 'Project exported.' })
    } catch {
      notify({ tone: 'error', message: 'Could not export the project.' })
    }
  }, [project, notify])

  const handleImportConfirmed = useCallback(
    (imported: ProjectData, warnings: string[]) => {
      setImportOpen(false)

      void (async () => {
        // The import dialog already asked the user to confirm this file, and
        // it warns that importing replaces the current project.
        await replaceProject(imported)

        notify({
          tone: 'success',
          message:
            warnings.length > 0
              ? `Imported "${imported.name}". ${warnings.join(' ')}`
              : `Imported "${imported.name}".`,
        })
      })()
    },
    [replaceProject, notify],
  )

  /* ---------------- Roles ---------------- */

  const handleRemoveRole = useCallback(
    (role: Role) => {
      const remove = () => dispatch({ type: 'role/remove', roleId: role.id })

      // Only warn when data would actually be lost.
      if (!roleHasEstimates(project, role.id)) {
        remove()
        return
      }

      confirmAnd(
        {
          title: `Delete role "${role.name}"?`,
          description:
            'This role has estimates. Deleting it will permanently remove those estimates from every task.',
          confirmLabel: 'Delete Role',
          tone: 'danger',
        },
        remove,
      )
    },
    [confirmAnd, dispatch, project],
  )

  /* ---------------- Phases, features, tasks ---------------- */

  const handleRemovePhase = useCallback(
    (phase: Phase) => {
      const remove = () => dispatch({ type: 'phase/remove', phaseId: phase.id })
      const taskCount = countTasksInPhase(phase)

      if (taskCount === 0 && phase.features.length === 0) {
        remove()
        return
      }

      confirmAnd(
        {
          title: `Delete "${phase.name}"?`,
          description: `This will permanently remove ${pluralize(
            phase.features.length,
            'main feature',
          )} and ${pluralize(taskCount, 'task')} with their estimates.`,
          confirmLabel: 'Delete Phase',
          tone: 'danger',
        },
        remove,
      )
    },
    [confirmAnd, dispatch],
  )

  const handleRemoveFeature = useCallback(
    (feature: MainFeature) => {
      const remove = () =>
        dispatch({ type: 'feature/remove', featureId: feature.id })
      const taskCount = countTasksInFeature(feature)

      if (taskCount === 0) {
        remove()
        return
      }

      confirmAnd(
        {
          title: `Delete "${feature.name}"?`,
          description: `This will permanently remove ${pluralize(
            taskCount,
            'task',
          )} and their estimates.`,
          confirmLabel: 'Delete Feature',
          tone: 'danger',
        },
        remove,
      )
    },
    [confirmAnd, dispatch],
  )

  const handleRemoveTask = useCallback(
    (task: Task) => {
      const remove = () => dispatch({ type: 'task/remove', taskId: task.id })
      const hasEstimates = Object.values(task.estimates).some(
        (value) => value !== null && value !== 0,
      )

      if (!hasEstimates) {
        remove()
        return
      }

      confirmAnd(
        {
          title: `Delete "${task.name}"?`,
          description: 'This will permanently remove its estimates.',
          confirmLabel: 'Delete Task',
          tone: 'danger',
        },
        remove,
      )
    },
    [confirmAnd, dispatch],
  )

  const phaseCount = project.phases.length

  const phaseCards = useMemo(
    () =>
      project.phases.map((phase, index) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          roles={project.roles}
          index={index}
          phaseCount={phaseCount}
          onRename={(name) =>
            dispatch({ type: 'phase/rename', phaseId: phase.id, name })
          }
          onToggle={(enabled) =>
            dispatch({ type: 'phase/setEnabled', phaseId: phase.id, enabled })
          }
          onToggleCollapsed={() =>
            dispatch({
              type: 'phase/setCollapsed',
              phaseId: phase.id,
              collapsed: !phase.collapsed,
            })
          }
          onDuplicate={() =>
            dispatch({ type: 'phase/duplicate', phaseId: phase.id })
          }
          onRemove={() => handleRemovePhase(phase)}
          onMove={(direction) =>
            dispatch({ type: 'phase/move', phaseId: phase.id, direction })
          }
          onSetNote={(note) =>
            dispatch({ type: 'phase/setNote', phaseId: phase.id, note })
          }
          onAddFeature={() =>
            dispatch({ type: 'feature/add', phaseId: phase.id })
          }
          onRenameFeature={(featureId, name) =>
            dispatch({ type: 'feature/rename', featureId, name })
          }
          onSetFeatureNote={(featureId, note) =>
            dispatch({ type: 'feature/setNote', featureId, note })
          }
          onToggleFeature={(featureId, enabled) =>
            dispatch({ type: 'feature/setEnabled', featureId, enabled })
          }
          onToggleFeatureCollapsed={(featureId, collapsed) =>
            dispatch({ type: 'feature/setCollapsed', featureId, collapsed })
          }
          onDuplicateFeature={(featureId) =>
            dispatch({ type: 'feature/duplicate', featureId })
          }
          onRemoveFeature={handleRemoveFeature}
          onMoveFeature={(featureId, direction) =>
            dispatch({ type: 'feature/move', featureId, direction })
          }
          onAddTask={(featureId) => dispatch({ type: 'task/add', featureId })}
          onRenameTask={(taskId, name) =>
            dispatch({ type: 'task/rename', taskId, name })
          }
          onToggleTask={(taskId, enabled) =>
            dispatch({ type: 'task/setEnabled', taskId, enabled })
          }
          onSetEstimate={(taskId, roleId, value) =>
            dispatch({ type: 'task/setEstimate', taskId, roleId, value })
          }
          onDuplicateTask={(taskId) =>
            dispatch({ type: 'task/duplicate', taskId })
          }
          onRemoveTask={handleRemoveTask}
          onMoveTask={(taskId, direction) =>
            dispatch({ type: 'task/move', taskId, direction })
          }
        />
      )),
    [
      project.phases,
      project.roles,
      phaseCount,
      dispatch,
      handleRemovePhase,
      handleRemoveFeature,
      handleRemoveTask,
    ],
  )

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading your project…
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16">
      {/*
        Keyboard users would otherwise tab through every header control on
        each visit; this jumps straight to the estimates.
      */}
      <a
        href="#estimator-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-sky-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to project content
      </a>

      <AppHeader
        projectName={project.name}
        persistent={persistent}
        onRenameProject={(name) => dispatch({ type: 'project/rename', name })}
        onNewProject={handleNewProject}
        onOpenImport={() => setImportOpen(true)}
        onExport={handleExport}
      />

      <main
        id="estimator-main"
        tabIndex={-1}
        className="mx-auto max-w-7xl space-y-4 px-4 py-6 outline-none sm:px-6"
      >
        <RoleManager
          roles={project.roles}
          onAdd={(name) => dispatch({ type: 'role/add', name })}
          onRename={(roleId, name) =>
            dispatch({ type: 'role/rename', roleId, name })
          }
          onMove={(roleId, direction) =>
            dispatch({ type: 'role/move', roleId, direction })
          }
          onRemove={handleRemoveRole}
          onInvalidName={(message) => notify({ tone: 'error', message })}
        />

        {phaseCards}

        {phaseCount === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No phases yet. Add one to start estimating.
          </p>
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: 'phase/add' })}
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <PlusIcon className="h-4 w-4" />
          Add Phase
        </button>

        <ProjectSummary
          project={project}
          onSetBurnRate={(roleId, burnRate) =>
            dispatch({ type: 'role/setBurnRate', roleId, burnRate })
          }
        />
      </main>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportConfirmed}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        tone={pending?.tone}
        onConfirm={() => pending?.onConfirm()}
        onCancel={closeConfirm}
      />

      <Toasts notices={notices} onDismiss={dismissNotice} />
    </div>
  )
}
