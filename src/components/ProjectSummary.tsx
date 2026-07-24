/**
 * Project summary: one row per phase, then per-role totals.
 *
 * The whole-project man-day grand total is deliberately not shown — a single
 * large number reads as alarming and is rarely the useful figure. Instead the
 * summary breaks work down per role (department), and turns each role's total
 * into elapsed working days via its burn rate (people working in parallel).
 * The project's timeline is the longest single-role track, since roles run in
 * parallel.
 *
 * Renders as a table on wide screens and stacked cards on narrow ones.
 */

import { useEffect, useState } from 'react'

import {
  calculatePhaseRoleTotal,
  calculateProjectRoleTotal,
  calculateProjectTimelineDays,
  calculateRawPhaseGrandTotal,
  calculateRoleDays,
  roleBurnRate,
} from '../domain/calculations'
import type { ProjectData, Role } from '../domain/types'
import { formatNumber, formatTotal } from './formatting'

/** Working days in a month, for the informal "~N months" timeline hint. */
const WORKING_DAYS_PER_MONTH = 20

export interface ProjectSummaryProps {
  project: ProjectData
  onSetBurnRate: (roleId: string, burnRate: number) => void
}

export function ProjectSummary({ project, onSetBurnRate }: ProjectSummaryProps) {
  const { roles, phases } = project
  const timelineDays = calculateProjectTimelineDays(project)
  const bottleneck = roles.find(
    (role) =>
      calculateRoleDays(calculateProjectRoleTotal(project, role.id), role) ===
        timelineDays && timelineDays > 0,
  )

  return (
    <section
      aria-labelledby="project-summary-heading"
      className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2
          id="project-summary-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Project Summary
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Burn rate = people working in parallel per role
        </p>
      </div>

      {phases.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No phases to summarise yet.
        </p>
      ) : (
        <>
          {/* Wide screens: a real table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-max border-collapse text-sm">
              <caption className="sr-only">
                Totals per phase and role, in man-days, with burn rate and
                elapsed working days per role
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium dark:bg-slate-900"
                  >
                    Phase
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Status
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.id}
                      scope="col"
                      className="min-w-[5rem] px-4 py-2 text-right font-medium"
                    >
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {phases.map((phase) => {
                  const rawTotal = calculateRawPhaseGrandTotal(phase, roles)

                  return (
                    <tr
                      key={phase.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        phase.enabled ? '' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium dark:bg-slate-900"
                      >
                        {phase.name}
                        {!phase.enabled && rawTotal > 0 && (
                          <span className="ml-2 whitespace-nowrap text-xs font-normal text-slate-400 dark:text-slate-500">
                            ({formatNumber(rawTotal)} md saved)
                          </span>
                        )}
                      </th>
                      <td className="px-4 py-2">
                        <StatusBadge enabled={phase.enabled} />
                      </td>
                      {roles.map((role) => (
                        <td
                          key={role.id}
                          className="px-4 py-2 text-right tabular-nums"
                        >
                          {formatTotal(calculatePhaseRoleTotal(phase, role.id))}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left dark:bg-slate-800/60"
                  >
                    Total man-days
                  </th>
                  <td className="px-4 py-2.5" />
                  {roles.map((role) => (
                    <td
                      key={role.id}
                      className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-100"
                    >
                      {formatTotal(calculateProjectRoleTotal(project, role.id))}
                    </td>
                  ))}
                </tr>

                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
                  >
                    Burn rate
                    <span className="ml-1 normal-case tracking-normal">
                      (people)
                    </span>
                  </th>
                  <td className="px-4 py-2" />
                  {roles.map((role) => (
                    <td key={role.id} className="px-4 py-2 text-right">
                      <BurnRateInput
                        role={role}
                        onCommit={(value) => onSetBurnRate(role.id, value)}
                      />
                    </td>
                  ))}
                </tr>

                <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left dark:bg-slate-800/60"
                  >
                    ≈ Working days
                  </th>
                  <td className="px-4 py-2.5" />
                  {roles.map((role) => {
                    const days = calculateRoleDays(
                      calculateProjectRoleTotal(project, role.id),
                      role,
                    )
                    const isBottleneck =
                      bottleneck?.id === role.id && timelineDays > 0
                    return (
                      <td
                        key={role.id}
                        className={`px-4 py-2.5 text-right tabular-nums ${
                          isBottleneck
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatTotal(days)}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Narrow screens: stacked cards. */}
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {phases.map((phase) => {
              const rawTotal = calculateRawPhaseGrandTotal(phase, roles)

              return (
                <li
                  key={phase.id}
                  className={`px-4 py-3 ${
                    phase.enabled ? '' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{phase.name}</span>
                    <StatusBadge enabled={phase.enabled} />
                  </div>

                  <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                    {roles.map((role) => (
                      <div key={role.id} className="flex gap-1">
                        <dt className="text-slate-500 dark:text-slate-400">
                          {role.name}:
                        </dt>
                        <dd className="tabular-nums">
                          {formatTotal(calculatePhaseRoleTotal(phase, role.id))}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {!phase.enabled && rawTotal > 0 && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {formatNumber(rawTotal)} man-days saved but excluded
                    </p>
                  )}
                </li>
              )
            })}

            <li className="space-y-3 bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              {roles.map((role) => {
                const md = calculateProjectRoleTotal(project, role.id)
                const days = calculateRoleDays(md, role)
                return (
                  <div key={role.id} className="text-sm">
                    <div className="flex items-center justify-between font-medium">
                      <span>{role.name}</span>
                      <span className="tabular-nums">
                        {formatTotal(md)} md → {formatTotal(days)} days
                      </span>
                    </div>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      Burn rate (people)
                      <BurnRateInput
                        role={role}
                        onCommit={(value) => onSetBurnRate(role.id, value)}
                      />
                    </label>
                  </div>
                )
              })}
            </li>
          </ul>

          {timelineDays > 0 && (
            <div className="border-t border-slate-200 bg-sky-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-sky-950/30">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Estimated timeline ≈ {formatNumber(timelineDays)} working days
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {' '}
                (~
                {formatNumber(
                  Math.round((timelineDays / WORKING_DAYS_PER_MONTH) * 10) / 10,
                )}{' '}
                months, dev only)
                {bottleneck && (
                  <> · longest track: {bottleneck.name}</>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Number input for a role's burn rate. Kept in local draft state so a
 * half-typed value (empty, "1.") does not fight the user, committing only
 * finite positive numbers and snapping back on blur.
 */
function BurnRateInput({
  role,
  onCommit,
}: {
  role: Role
  onCommit: (value: number) => void
}) {
  const canonical = String(roleBurnRate(role))
  const [draft, setDraft] = useState(canonical)

  // Re-sync when the stored value changes elsewhere (import, duplicate, undo).
  useEffect(() => {
    setDraft(canonical)
  }, [canonical])

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0.5}
      step={0.5}
      aria-label={`Burn rate for ${role.name}, people working in parallel`}
      value={draft}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const parsed = Number(raw)
        if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
          onCommit(parsed)
        }
      }}
      onBlur={() => setDraft(String(roleBurnRate(role)))}
      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-sky-900"
    />
  )
}

/** Status is text, not colour alone — required by the accessibility rules. */
function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      Enabled
    </span>
  ) : (
    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      Disabled
    </span>
  )
}
