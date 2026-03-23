import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'

export function generateMuiPalette(seedHex, mode = 'light') {
  const theme = themeFromSourceColor(argbFromHex(seedHex))
  const scheme = mode === 'dark' ? theme.schemes.dark : theme.schemes.light

  return {
    primary: {
      main: hexFromArgb(scheme.primary),
      light: hexFromArgb(scheme.primaryContainer),
      dark: hexFromArgb(scheme.onPrimaryContainer),
      contrastText: hexFromArgb(scheme.onPrimary),
    },
    secondary: {
      main: hexFromArgb(scheme.secondary),
      light: hexFromArgb(scheme.secondaryContainer),
      dark: hexFromArgb(scheme.onSecondaryContainer),
      contrastText: hexFromArgb(scheme.onSecondary),
    },
    info: {
      main: hexFromArgb(scheme.tertiary),
      light: hexFromArgb(scheme.tertiaryContainer),
      dark: hexFromArgb(scheme.onTertiaryContainer),
      contrastText: hexFromArgb(scheme.onTertiary),
    },
    error: {
      main: hexFromArgb(scheme.error),
      light: hexFromArgb(scheme.errorContainer),
      dark: hexFromArgb(scheme.onErrorContainer),
      contrastText: hexFromArgb(scheme.onError),
    },
    background: {
      default: hexFromArgb(scheme.surface),
      paper: hexFromArgb(scheme.surfaceVariant),
    },
    text: {
      primary: hexFromArgb(scheme.onSurface),
      secondary: hexFromArgb(scheme.onSurfaceVariant),
    },
    divider: hexFromArgb(scheme.outline),
  }
}
