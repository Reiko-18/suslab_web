import { useMemo, createContext, useContext } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useThemeSettings } from './useThemeSettings'
import type { ThemeSettings } from './useThemeSettings'
import { generateMuiPalette } from './colorUtils'

const ThemeSettingsContext = createContext<ThemeSettings | null>(null)

export function useThemeControls(): ThemeSettings | null {
  return useContext(ThemeSettingsContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useThemeSettings()
  const { mode, seedColor } = settings

  const theme = useMemo(() => {
    const palette = generateMuiPalette(seedColor, mode)
    return createTheme({
      palette: {
        mode,
        ...palette,
      },
      typography: {
        fontFamily: "'Roboto', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans JP', system-ui, sans-serif",
      },
      shape: {
        borderRadius: 12,
      },
    })
  }, [mode, seedColor])

  return (
    <ThemeSettingsContext.Provider value={settings}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeSettingsContext.Provider>
  )
}
