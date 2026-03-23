import { useState, useCallback } from 'react'

const MODE_KEY = 'suslab-theme-mode'
const SEED_KEY = 'suslab-theme-seed'
const DEFAULT_SEED = '#6750A4'

function getStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function useThemeSettings() {
  const [mode, setModeState] = useState(() => getStored(MODE_KEY, 'light'))
  const [seedColor, setSeedState] = useState(() => getStored(SEED_KEY, DEFAULT_SEED))

  const setMode = useCallback((m) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
  }, [])

  const setSeedColor = useCallback((c) => {
    setSeedState(c)
    localStorage.setItem(SEED_KEY, c)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(MODE_KEY, next)
      return next
    })
  }, [])

  return { mode, seedColor, setMode, setSeedColor, toggleMode }
}
