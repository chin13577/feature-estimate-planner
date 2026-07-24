/**
 * Light/dark theme.
 *
 * Two settings only: light (the default) and dark. The resolved theme is
 * applied as a `dark` class on <html>, which is what Tailwind's
 * `darkMode: 'class'` keys off.
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

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'manday-estimator-theme-v1'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Flip between light and dark, for the toolbar button. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Read the saved theme, defaulting to light.
 *
 * The OS preference is deliberately ignored: light is the default regardless
 * of system settings, and dark is opt-in.
 */
function readStoredTheme(): Theme {
  try {
    // 'system' may be present from an earlier version; it resolves to light.
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    // Makes native controls (scrollbars, date pickers) match the theme.
    root.style.colorScheme = theme
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // A blocked write costs the preference on reload, nothing more.
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
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
