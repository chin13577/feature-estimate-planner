/**
 * Project summary: one row per phase, then the project total.
 *
 * Disabled phases stay visible with calculated totals of 0, plus muted
 * secondary text showing what they would contribute if re-enabled — the
 * spec's optional "saved raw estimate total".
 *
 * Renders as a table on wide screens and stacked cards on narrow ones.
 */

import {
  calculatePhaseGrandTotal,
  calculatePhaseRoleTotal,
  calculateProjectGrandTotal,
  calculateProjectRoleTotal,
  calculateRawPhaseGrandTotal,
} from '../domain/calculations'
import type { ProjectData } from '../domain/types'
import { formatNumber, formatTotal } from './formatting'

export interface ProjectSummaryProps {
  project: ProjectData
}

export function ProjectSummary({ project }: ProjectSummaryProps) {
  const { roles, phases } = project
  const projectGrandTotal = calculateProjectGrandTotal(project)

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
          Project total:{' '}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatNumber(projectGrandTotal)} man-days
          </span>
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
                Totals per phase and role, in man-days
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
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Total
                  </th>
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
                      </th>
                      <td className="px-4 py-2">
                        <StatusBadge enabled={phase.enabled} />
                      </td>
                      {roles.map((role) => (
                        <td
                          key={role.id}
                          className="px-4 py-2 text-right tabular-nums"
                        >
                          {formatTotal(
                            calculatePhaseRoleTotal(phase, role.id),
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span className="font-medium">
                          {formatTotal(calculatePhaseGrandTotal(phase, roles))}
                        </span>
                        {!phase.enabled && rawTotal > 0 && (
                          <span className="ml-2 whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
                            ({formatNumber(rawTotal)} saved)
                          </span>
                        )}
                      </td>
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
                    Project Total
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
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-100">
                    {formatNumber(projectGrandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Narrow screens: stacked cards, per the responsive rules. */}
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
                    <div className="flex gap-1 font-medium">
                      <dt>Total:</dt>
                      <dd className="tabular-nums">
                        {formatTotal(calculatePhaseGrandTotal(phase, roles))}
                      </dd>
                    </div>
                  </dl>

                  {!phase.enabled && rawTotal > 0 && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {formatNumber(rawTotal)} man-days saved but excluded
                    </p>
                  )}
                </li>
              )
            })}

            <li className="bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Project Total</span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(projectGrandTotal)}
                </span>
              </div>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                {roles.map((role) => (
                  <div key={role.id} className="flex gap-1">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {role.name}:
                    </dt>
                    <dd className="tabular-nums">
                      {formatTotal(calculateProjectRoleTotal(project, role.id))}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          </ul>
        </>
      )}
    </section>
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
