/**
 * Light/dark theme.
 *
 * Three settings: explicit light, explicit dark, or follow the OS. The
 * resolved theme is applied as a `dark` class on <html>, which is what
 * Tailwind's `darkMode: 'class'` keys off.
 *
 * The choice is stored separately from project data — it is a per-device
 * display preference, not part of an estimate, and must not travel through
 * JSON export.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'manday-estimator-theme-v1'

interface ThemeContextValue {
  setting: ThemeSetting
  resolved: ResolvedTheme
  setSetting: (setting: ThemeSetting) => void
  /** Cycle light → dark → system, for the toolbar button. */
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredSetting(): ThemeSetting {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Storage blocked — fall through to the default.
  }
  return 'system'
}

function prefersDark(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(readStoredSetting)
  const [systemDark, setSystemDark] = useState(prefersDark)

  // Track OS changes so 'system' stays live rather than snapshotting at load.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return

    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme =
    setting === 'system' ? (systemDark ? 'dark' : 'light') : setting

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    // Makes native controls (scrollbars, date pickers) match the theme.
    root.style.colorScheme = resolved
  }, [resolved])

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // A blocked write costs the preference on reload, nothing more.
    }
  }, [])

  const cycle = useCallback(() => {
    setSetting(
      setting === 'light' ? 'dark' : setting === 'dark' ? 'system' : 'light',
    )
  }, [setting, setSetting])

  const value = useMemo(
    () => ({ setting, resolved, setSetting, cycle }),
    [setting, resolved, setSetting, cycle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
