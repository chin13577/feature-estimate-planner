/**
 * One phase: header, its features, totals, and the free-text note.
 */

import {
  calculatePhaseGrandTotal,
  calculatePhaseRoleTotal,
} from '../domain/calculations'
import { getPhaseEnabledState } from '../domain/enabledState'
import type { MainFeature, Phase, Role, Task } from '../domain/types'
import { EditableText } from './EditableText'
import { FeatureSection } from './FeatureSection'
import { IconButton } from './IconButton'
import { TriStateCheckbox } from './TriStateCheckbox'
import { formatTotal } from './formatting'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
} from './icons'

export interface PhaseCardProps {
  phase: Phase
  roles: Role[]
  index: number
  phaseCount: number
  onRename: (name: string) => void
  onToggle: (enabled: boolean) => void
  onToggleCollapsed: () => void
  onDuplicate: () => void
  onRemove: () => void
  onMove: (direction: 'up' | 'down') => void
  onSetNote: (note: string) => void
  onAddFeature: () => void
  onRenameFeature: (featureId: string, name: string) => void
  onSetFeatureNote: (featureId: string, note: string) => void
  onToggleFeature: (featureId: string, enabled: boolean) => void
  onToggleFeatureCollapsed: (featureId: string, collapsed: boolean) => void
  onDuplicateFeature: (featureId: string) => void
  onRemoveFeature: (feature: MainFeature) => void
  onMoveFeature: (featureId: string, direction: 'up' | 'down') => void
  onAddTask: (featureId: string) => void
  onRenameTask: (taskId: string, name: string) => void
  onToggleTask: (taskId: string, enabled: boolean) => void
  onSetEstimate: (taskId: string, roleId: string, value: number | null) => void
  onDuplicateTask: (taskId: string) => void
  onRemoveTask: (task: Task) => void
  onMoveTask: (taskId: string, direction: 'up' | 'down') => void
}

export function PhaseCard(props: PhaseCardProps) {
  const { phase, roles, index, phaseCount } = props
  const state = getPhaseEnabledState(phase)
  const grandTotal = calculatePhaseGrandTotal(phase, roles)

  return (
    <section
      aria-label={`Phase ${phase.name}`}
      className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        phase.enabled ? '' : 'opacity-60'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <IconButton
          label={
            phase.collapsed
              ? `Expand phase ${phase.name}`
              : `Collapse phase ${phase.name}`
          }
          onClick={props.onToggleCollapsed}
        >
          {phase.collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </IconButton>

        <TriStateCheckbox
          state={state}
          label={`Include phase ${phase.name} in totals`}
          onChange={props.onToggle}
        />

        <EditableText
          label="Phase name"
          value={phase.name}
          onCommit={props.onRename}
          className={`text-base font-semibold text-slate-900 dark:text-slate-100 ${
            phase.enabled ? '' : 'line-through decoration-slate-400'
          }`}
        />

        {!phase.enabled && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-400">
            Excluded
          </span>
        )}
        {phase.enabled && state === 'partial' && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            Partial
          </span>
        )}

        <span className="ml-auto whitespace-nowrap text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
          {formatTotal(grandTotal)} md
        </span>

        <div className="flex items-center gap-0.5">
          <IconButton
            label={`Move phase ${phase.name} up`}
            disabled={index === 0}
            onClick={() => props.onMove('up')}
          >
            <ChevronUpIcon />
          </IconButton>
          <IconButton
            label={`Move phase ${phase.name} down`}
            disabled={index === phaseCount - 1}
            onClick={() => props.onMove('down')}
          >
            <ChevronDownIcon />
          </IconButton>
          <IconButton
            label={`Duplicate phase ${phase.name}`}
            onClick={props.onDuplicate}
          >
            <CopyIcon />
          </IconButton>
          <IconButton
            label={`Delete phase ${phase.name}`}
            tone="danger"
            onClick={props.onRemove}
          >
            <TrashIcon />
          </IconButton>
        </div>
      </header>

      {!phase.collapsed && (
        <div className="space-y-3 p-4">
          {phase.features.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
              No main features yet.
            </p>
          )}

          {phase.features.map((feature, featureIndex) => (
            <FeatureSection
              key={feature.id}
              phase={phase}
              feature={feature}
              roles={roles}
              index={featureIndex}
              featureCount={phase.features.length}
              onRename={(name) => props.onRenameFeature(feature.id, name)}
              onToggle={(enabled) => props.onToggleFeature(feature.id, enabled)}
              onSetNote={(note) => props.onSetFeatureNote(feature.id, note)}
              onToggleCollapsed={() =>
                props.onToggleFeatureCollapsed(feature.id, !feature.collapsed)
              }
              onDuplicate={() => props.onDuplicateFeature(feature.id)}
              onRemove={() => props.onRemoveFeature(feature)}
              onMove={(direction) => props.onMoveFeature(feature.id, direction)}
              onAddTask={() => props.onAddTask(feature.id)}
              onRenameTask={props.onRenameTask}
              onToggleTask={props.onToggleTask}
              onSetEstimate={props.onSetEstimate}
              onDuplicateTask={props.onDuplicateTask}
              onRemoveTask={props.onRemoveTask}
              onMoveTask={props.onMoveTask}
            />
          ))}

          <button
            type="button"
            onClick={props.onAddFeature}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Main Feature
          </button>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:bg-slate-800/60 dark:border-slate-800">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phase Total
              </span>
              {roles.map((role) => (
                <span key={role.id} className="text-sm text-slate-600 dark:text-slate-400">
                  {role.name}:{' '}
                  <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {formatTotal(calculatePhaseRoleTotal(phase, role.id))}
                  </span>
                </span>
              ))}
              <span className="ml-auto text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                Grand Total: {formatTotal(grandTotal)} man-days
              </span>
            </div>

            <label
              htmlFor={`note-${phase.id}`}
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Note
            </label>
            <textarea
              id={`note-${phase.id}`}
              rows={2}
              value={phase.note}
              placeholder="Assumptions, exclusions, open questions…"
              onChange={(event) => props.onSetNote(event.target.value)}
              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}
    </section>
  )
}
