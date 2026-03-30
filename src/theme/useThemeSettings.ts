import { useState, useCallback } from 'react'
import type { ThemeMode } from './colorUtils'

const MODE_KEY = 'suslab-theme-mode'
const SEED_KEY = 'suslab-theme-seed'
const DEFAULT_SEED = '#7C9070'

function getStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export interface ThemeSettings {
  mode: ThemeMode
  seedColor: string
  setMode: (m: ThemeMode) => void
  setSeedColor: (c: string) => void
  toggleMode: () => void
}

export function useThemeSettings(): ThemeSettings {
  const [mode, setModeState] = useState<ThemeMode>(() => getStored(MODE_KEY, 'light') as ThemeMode)
  const [seedColor, setSeedState] = useState<string>(() => getStored(SEED_KEY, DEFAULT_SEED))

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
  }, [])

  const setSeedColor = useCallback((c: string) => {
    setSeedState(c)
    localStorage.setItem(SEED_KEY, c)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(MODE_KEY, next)
      return next
    })
  }, [])

  return { mode, seedColor, setMode, setSeedColor, toggleMode }
}
