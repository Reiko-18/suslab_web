import { useEffect, useMemo, createContext, useContext } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useTranslation } from 'react-i18next'
import { useThemeSettings } from './useThemeSettings'
import type { ThemeSettings } from './useThemeSettings'
import { generateCssVariables, getFontStack, generateMuiPalette } from './colorUtils'

const ThemeSettingsContext = createContext<ThemeSettings | null>(null)

export function useThemeControls(): ThemeSettings {
  const ctx = useContext(ThemeSettingsContext)
  if (!ctx) throw new Error('useThemeControls must be used within ThemeProvider')
  return ctx
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useThemeSettings()
  const { mode, seedColor } = settings
  const { i18n } = useTranslation()

  const muiTheme = useMemo(() => {
    const palette = generateMuiPalette(seedColor, mode)
    return createTheme({
      palette: { mode, ...palette },
      typography: { fontFamily: "'Noto Sans', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans JP', sans-serif" },
      shape: { borderRadius: 12 },
    })
  }, [mode, seedColor])

  const cssVars = useMemo(
    () => generateCssVariables(seedColor, mode),
    [seedColor, mode],
  )

  useEffect(() => {
    const root = document.documentElement
    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value)
    }
    root.style.setProperty('--font-primary', getFontStack(i18n.language))
    root.lang = i18n.language
  }, [cssVars, i18n.language])

  return (
    <ThemeSettingsContext.Provider value={settings}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeSettingsContext.Provider>
  )
}
