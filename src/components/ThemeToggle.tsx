/**
 * Light/dark switch.
 *
 * The icon shows the theme you would switch *to*, which is the convention
 * users expect from a two-state toggle. The accessible name says so
 * explicitly rather than relying on that convention.
 */

import { useTheme } from '../state/ThemeProvider'
import { MoonIcon, SunIcon } from './icons'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {isDark ? (
        <SunIcon className="h-4 w-4" />
      ) : (
        <MoonIcon className="h-4 w-4" />
      )}
      <span className="sr-only sm:not-sr-only">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
