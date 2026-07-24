/**
 * Theme switcher: light → dark → system.
 *
 * A single cycling button rather than a menu — three states are few enough
 * that stepping through them is faster than opening a dropdown. The current
 * state is announced in the accessible name, not just the icon.
 */

import { useTheme } from '../state/ThemeProvider'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

const LABELS = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
} as const

const NEXT = {
  light: 'dark',
  dark: 'system',
  system: 'light',
} as const

export function ThemeToggle() {
  const { setting, cycle } = useTheme()

  const Icon =
    setting === 'light' ? SunIcon : setting === 'dark' ? MoonIcon : MonitorIcon

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABELS[setting]}. Switch to ${LABELS[NEXT[setting]].toLowerCase()}`}
      title={`${LABELS[setting]} — click for ${LABELS[NEXT[setting]].toLowerCase()}`}
      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">
        {setting === 'system' ? 'Auto' : setting === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}
