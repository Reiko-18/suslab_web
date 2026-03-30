import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'

export type ThemeMode = 'light' | 'dark'

export interface CssVariableMap {
  [key: string]: string
}

const FONT_STACKS: Record<string, string> = {
  en: "'Noto Sans', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans SC', sans-serif",
  'zh-TW': "'Noto Sans TC', 'Noto Sans', sans-serif",
  'zh-CN': "'Noto Sans SC', 'Noto Sans', sans-serif",
  ja: "'Noto Sans JP', 'Noto Sans', sans-serif",
}

export function getFontStack(lang: string): string {
  return FONT_STACKS[lang] || FONT_STACKS.en
}

export function generateCssVariables(seedHex: string, mode: ThemeMode): CssVariableMap {
  const theme = themeFromSourceColor(argbFromHex(seedHex))
  const scheme = mode === 'dark' ? theme.schemes.dark : theme.schemes.light

  return {
    '--color-surface': hexFromArgb(scheme.surface),
    '--color-surface-dim': hexFromArgb((scheme as Record<string, number>).surfaceDim ?? scheme.surface),
    '--color-surface-container': hexFromArgb(scheme.surfaceVariant),
    '--color-surface-bright': hexFromArgb((scheme as Record<string, number>).surfaceBright ?? scheme.surfaceVariant),
    '--color-on-surface': hexFromArgb(scheme.onSurface),
    '--color-on-surface-muted': hexFromArgb(scheme.onSurfaceVariant),
    '--color-on-surface-dim': hexFromArgb(scheme.outline),
    '--color-primary': hexFromArgb(scheme.primary),
    '--color-on-primary': hexFromArgb(scheme.onPrimary),
    '--color-primary-container': hexFromArgb(scheme.primaryContainer),
    '--color-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),
    '--color-secondary': hexFromArgb(scheme.secondary),
    '--color-on-secondary': hexFromArgb(scheme.onSecondary),
    '--color-error': hexFromArgb(scheme.error),
    '--color-on-error': hexFromArgb(scheme.onError),
    '--color-success': '#3ba55c',
    '--color-warning': '#faa61a',
    '--color-divider': hexFromArgb(scheme.outline),
    '--radius-xs': '2px',
    '--radius-sm': '5px',
    '--radius-md': '10px',
    '--radius-lg': '20px',
    '--radius-full': '100px',
    '--spacing-1': '4px',
    '--spacing-2': '8px',
    '--spacing-3': '12px',
    '--spacing-4': '16px',
    '--spacing-5': '20px',
    '--spacing-6': '24px',
    '--spacing-8': '32px',
    '--spacing-10': '40px',
    '--spacing-12': '48px',
    '--spacing-16': '64px',
    '--transition-fast': '150ms ease',
    '--transition-normal': '250ms ease',
    '--transition-slow': '350ms ease',
    '--z-dropdown': '100',
    '--z-sticky': '200',
    '--z-overlay': '300',
    '--z-dialog': '400',
    '--z-snackbar': '500',
  }
}

