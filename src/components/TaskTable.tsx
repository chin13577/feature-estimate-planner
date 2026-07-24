/**
 * Task table for one feature.
 *
 * The item-name column is sticky so it stays visible when many role columns
 * force horizontal scrolling, and the whole table scrolls inside its own
 * container rather than widening the page.
 */

import {
  calculateFeatureGrandTotal,
  calculateFeatureRoleTotal,
  estimateToNumber,
  isTaskEffectivelyEnabled,
} from '../domain/calculations'
import type { MainFeature, Phase, Role, Task } from '../domain/types'
import { EditableText } from './EditableText'
import { EstimateInput } from './EstimateInput'
import { IconButton } from './IconButton'
import { formatTotal } from './formatting'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
} from './icons'

export interface TaskTableProps {
  phase: Phase
  feature: MainFeature
  roles: Role[]
  onRenameTask: (taskId: string, name: string) => void
  onToggleTask: (taskId: string, enabled: boolean) => void
  onSetEstimate: (taskId: string, roleId: string, value: number | null) => void
  onDuplicateTask: (taskId: string) => void
  onRemoveTask: (task: Task) => void
  onMoveTask: (taskId: string, direction: 'up' | 'down') => void
  onAddTask: () => void
}

/** Sticky first column, shared by header cells and body cells. */
const STICKY_NAME = 'sticky left-0 z-10'

export function TaskTable({
  phase,
  feature,
  roles,
  onRenameTask,
  onToggleTask,
  onSetEstimate,
  onDuplicateTask,
  onRemoveTask,
  onMoveTask,
  onAddTask,
}: TaskTableProps) {
  const hasRoles = roles.length > 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">
          Tasks and man-day estimates for {feature.name}
        </caption>

        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th
              scope="col"
              className={`${STICKY_NAME} bg-slate-50 px-3 py-2 text-left font-medium dark:bg-slate-800/60`}
            >
              <span className="sr-only">Enabled</span>
              Task
            </th>
            {roles.map((role) => (
              <th
                key={role.id}
                scope="col"
                className="min-w-[5.5rem] bg-slate-50 px-3 py-2 text-right font-medium dark:bg-slate-800/60"
              >
                {role.name}
              </th>
            ))}
            <th
              scope="col"
              className="bg-slate-50 px-3 py-2 text-right font-medium dark:bg-slate-800/60"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {feature.tasks.length === 0 && (
            <tr>
              <td
                colSpan={roles.length + 2}
                className="px-3 py-4 text-center text-slate-400 dark:text-slate-500"
              >
                No tasks yet.
              </td>
            </tr>
          )}

          {feature.tasks.map((task, index) => {
            const contributes = isTaskEffectivelyEnabled(phase, feature, task)
            // Dimming reflects the *effective* state: a task inside a disabled
            // feature is excluded from totals even though its own box is ticked.
            const dimmed = !contributes

            return (
              <tr
                key={task.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  dimmed
                    ? 'bg-slate-50/60 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500'
                    : 'hover:bg-sky-50/40 dark:hover:bg-sky-950/30'
                }`}
              >
                <td
                  className={`${STICKY_NAME} ${dimmed ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-900'} px-3 py-1.5`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      aria-label={`Include task ${task.name} in totals`}
                      onChange={(event) =>
                        onToggleTask(task.id, event.target.checked)
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-400 text-sky-600 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 dark:border-slate-500"
                    />
                    <EditableText
                      label="Task name"
                      value={task.name}
                      onCommit={(name) => onRenameTask(task.id, name)}
                      className={
                        task.enabled ? '' : 'line-through decoration-slate-400'
                      }
                    />
                    {!task.enabled && (
                      // State is conveyed by text as well as opacity, per the
                      // accessibility rules.
                      <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                        Excluded
                      </span>
                    )}
                  </div>
                </td>

                {roles.map((role) => (
                  <td key={role.id} className="px-1 py-1">
                    <EstimateInput
                      label={`${role.name} estimate for ${task.name}`}
                      value={task.estimates[role.id] ?? null}
                      onCommit={(value) =>
                        onSetEstimate(task.id, role.id, value)
                      }
                    />
                  </td>
                ))}

                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <IconButton
                      label={`Move task ${task.name} up`}
                      disabled={index === 0}
                      onClick={() => onMoveTask(task.id, 'up')}
                    >
                      <ChevronUpIcon />
                    </IconButton>
                    <IconButton
                      label={`Move task ${task.name} down`}
                      disabled={index === feature.tasks.length - 1}
                      onClick={() => onMoveTask(task.id, 'down')}
                    >
                      <ChevronDownIcon />
                    </IconButton>
                    <IconButton
                      label={`Duplicate task ${task.name}`}
                      onClick={() => onDuplicateTask(task.id)}
                    >
                      <CopyIcon />
                    </IconButton>
                    <IconButton
                      label={`Delete task ${task.name}`}
                      tone="danger"
                      onClick={() => onRemoveTask(task)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium dark:bg-slate-800/60 dark:border-slate-700">
            <th
              scope="row"
              className={`${STICKY_NAME} bg-slate-50 px-3 py-2 text-left dark:bg-slate-800/60`}
            >
              Feature Total
            </th>
            {roles.map((role) => (
              <td
                key={role.id}
                className="px-3 py-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
              >
                {formatTotal(calculateFeatureRoleTotal(phase, feature, role.id))}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100">
              {hasRoles
                ? `${formatTotal(calculateFeatureGrandTotal(phase, feature, roles))} md`
                : '-'}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onAddTask}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-sky-700 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-sky-950/40"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Task
        </button>
      </div>
    </div>
  )
}

/** Raw sum for a task, used by delete confirmations to warn about data loss. */
export function taskHasEstimates(task: Task): boolean {
  return Object.values(task.estimates).some(
    (value) => estimateToNumber(value) > 0,
  )
}
