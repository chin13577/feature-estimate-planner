/**
 * Display formatting for computed totals.
 */

/**
 * Render a total for the UI.
 *
 * Zero shows as `-` to match empty estimate cells, so a column of blanks does
 * not read as a wall of zeroes. Decimals keep only the digits they need:
 * 5 renders as "5", 5.5 as "5.5".
 */
export function formatTotal(value: number): string {
  if (value === 0) return '-'
  return String(Number(value.toFixed(2)))
}

/** Like {@link formatTotal} but always numeric — used in summary rows. */
export function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)))
}

/** e.g. "3 tasks" / "1 task" for confirmation messages. */
export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}
