/**
 * One main feature inside a phase: header, task table, totals.
 */

import { calculateFeatureGrandTotal } from '../domain/calculations'
import { getFeatureEnabledState } from '../domain/enabledState'
import type { MainFeature, Phase, Role, Task } from '../domain/types'
import { EditableText } from './EditableText'
import { IconButton } from './IconButton'
import { TaskTable } from './TaskTable'
import { TriStateCheckbox } from './TriStateCheckbox'
import { formatTotal } from './formatting'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  TrashIcon,
} from './icons'

export interface FeatureSectionProps {
  phase: Phase
  feature: MainFeature
  roles: Role[]
  index: number
  featureCount: number
  onRename: (name: string) => void
  onToggle: (enabled: boolean) => void
  onSetNote: (note: string) => void
  onToggleCollapsed: () => void
  onDuplicate: () => void
  onRemove: () => void
  onMove: (direction: 'up' | 'down') => void
  onAddTask: () => void
  onRenameTask: (taskId: string, name: string) => void
  onToggleTask: (taskId: string, enabled: boolean) => void
  onSetEstimate: (taskId: string, roleId: string, value: number | null) => void
  onDuplicateTask: (taskId: string) => void
  onRemoveTask: (task: Task) => void
  onMoveTask: (taskId: string, direction: 'up' | 'down') => void
}

export function FeatureSection({
  phase,
  feature,
  roles,
  index,
  featureCount,
  onRename,
  onToggle,
  onSetNote,
  onToggleCollapsed,
  onDuplicate,
  onRemove,
  onMove,
  onAddTask,
  onRenameTask,
  onToggleTask,
  onSetEstimate,
  onDuplicateTask,
  onRemoveTask,
  onMoveTask,
}: FeatureSectionProps) {
  const state = getFeatureEnabledState(feature)
  // A feature inside a disabled phase contributes nothing, so it is dimmed
  // even when its own checkbox is ticked.
  const dimmed = !phase.enabled || !feature.enabled
  const grandTotal = calculateFeatureGrandTotal(phase, feature, roles)

  return (
    <section
      aria-label={`Main feature ${feature.name}`}
      className={`rounded-md border border-slate-200 dark:border-slate-800 ${dimmed ? 'opacity-60' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:bg-slate-800/60 dark:border-slate-800">
        <IconButton
          label={
            feature.collapsed
              ? `Expand feature ${feature.name}`
              : `Collapse feature ${feature.name}`
          }
          onClick={onToggleCollapsed}
        >
          {feature.collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </IconButton>

        <TriStateCheckbox
          state={state}
          label={`Include feature ${feature.name} in totals`}
          onChange={onToggle}
        />

        <EditableText
          label="Feature name"
          value={feature.name}
          onCommit={onRename}
          className={`font-medium text-slate-800 dark:text-slate-200 ${
            feature.enabled ? '' : 'line-through decoration-slate-400'
          }`}
        />

        {!feature.enabled && (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-400">
            Excluded
          </span>
        )}
        {feature.enabled && state === 'partial' && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            Partial
          </span>
        )}

        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-slate-600 dark:text-slate-400">
          {formatTotal(grandTotal)} md
        </span>

        <div className="flex items-center gap-0.5">
          <IconButton
            label={`Move feature ${feature.name} up`}
            disabled={index === 0}
            onClick={() => onMove('up')}
          >
            <ChevronUpIcon />
          </IconButton>
          <IconButton
            label={`Move feature ${feature.name} down`}
            disabled={index === featureCount - 1}
            onClick={() => onMove('down')}
          >
            <ChevronDownIcon />
          </IconButton>
          <IconButton
            label={`Duplicate feature ${feature.name}`}
            onClick={onDuplicate}
          >
            <CopyIcon />
          </IconButton>
          <IconButton
            label={`Delete feature ${feature.name}`}
            tone="danger"
            onClick={onRemove}
          >
            <TrashIcon />
          </IconButton>
        </div>
      </header>

      {/* Single-line description, directly under the feature title. */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <label
          htmlFor={`feature-note-${feature.id}`}
          className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
        >
          Description
        </label>
        <input
          id={`feature-note-${feature.id}`}
          type="text"
          value={feature.note ?? ''}
          placeholder="Short description…"
          onChange={(event) => onSetNote(event.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
      </div>

      {!feature.collapsed && (
        <TaskTable
          phase={phase}
          feature={feature}
          roles={roles}
          onRenameTask={onRenameTask}
          onToggleTask={onToggleTask}
          onSetEstimate={onSetEstimate}
          onDuplicateTask={onDuplicateTask}
          onRemoveTask={onRemoveTask}
          onMoveTask={onMoveTask}
          onAddTask={onAddTask}
        />
      )}
    </section>
  )
}
