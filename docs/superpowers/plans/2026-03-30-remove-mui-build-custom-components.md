# Remove MUI & Build Custom Component Library — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all MUI dependencies and rebuild every UI component from scratch using Emotion + CSS Custom Properties, aligned to the Figma design spec.

**Architecture:** CSS Custom Properties for theming (driven by Material Color Utilities), Emotion `css`/`styled` for component styling, Google Material Symbols for icons via CDN, Google Noto fonts per language via CDN. All components self-contained in `src/components/ui/` and `src/components/layout/`.

**Tech Stack:** React 19, Emotion, @material/material-color-utilities, Google Fonts CDN, Google Material Symbols CDN, Vite 8

**Spec:** `docs/superpowers/specs/2026-03-30-remove-mui-custom-components-design.md`

**Migration Strategy:** MUI packages remain installed throughout Chunks 1-5. The new custom components and the old MUI components coexist during migration. MUI is only uninstalled in the final Chunk 6 after ALL consumers have been migrated. This ensures the build stays green at every commit.

---

## Chunk 1: Foundation (Theme, Fonts, Icons, Reset, Hooks)

### Task 1: Update `index.html` — Fonts & Material Symbols CDN

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace Google Fonts link to include Noto Sans with weight 500 + Material Symbols**

Replace the current font `<link>` in `index.html` (line 9) with:

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
```

Remove the old Roboto font link entirely.

- [ ] **Step 2: Verify fonts load**

Run: `npm run dev`
Open browser devtools → Network tab → filter "fonts.googleapis" → confirm 2 CSS loads.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: 更新 Google Fonts CDN — Noto Sans 全語系 + Material Symbols"
```

---

### Task 2: Create CSS Reset

**Files:**
- Create: `src/styles/reset.css`

- [ ] **Step 1: Create `src/styles/reset.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-primary);
  color: var(--color-on-surface);
  background: var(--color-surface-dim);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
  min-height: 100vh;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: none;
}

a {
  color: inherit;
  text-decoration: none;
}

ul, ol {
  list-style: none;
}

h1, h2, h3, h4, h5, h6 {
  font-size: inherit;
  font-weight: inherit;
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/reset.css
git commit -m "chore: 新增 CSS reset 取代 MUI CssBaseline"
```

---

### Task 3: Rewrite `colorUtils.ts` — Generate CSS Variable Map

**Files:**
- Modify: `src/theme/colorUtils.ts`

- [ ] **Step 1: Add CSS variable generation to `colorUtils.ts` (keep existing `generateMuiPalette` during migration)**

```typescript
import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'

export type ThemeMode = 'light' | 'dark'

// ---- Kept during migration (removed in Task 25) ----
export interface MuiPalette {
  primary: { main: string; light: string; dark: string; contrastText: string }
  secondary: { main: string; light: string; dark: string; contrastText: string }
  info: { main: string; light: string; dark: string; contrastText: string }
  error: { main: string; light: string; dark: string; contrastText: string }
  background: { default: string; paper: string }
  text: { primary: string; secondary: string }
  divider: string
}

export function generateMuiPalette(seedHex: string, mode: ThemeMode = 'light'): MuiPalette {
  const theme = themeFromSourceColor(argbFromHex(seedHex))
  const scheme = mode === 'dark' ? theme.schemes.dark : theme.schemes.light
  return {
    primary: { main: hexFromArgb(scheme.primary), light: hexFromArgb(scheme.primaryContainer), dark: hexFromArgb(scheme.onPrimaryContainer), contrastText: hexFromArgb(scheme.onPrimary) },
    secondary: { main: hexFromArgb(scheme.secondary), light: hexFromArgb(scheme.secondaryContainer), dark: hexFromArgb(scheme.onSecondaryContainer), contrastText: hexFromArgb(scheme.onSecondary) },
    info: { main: hexFromArgb(scheme.tertiary), light: hexFromArgb(scheme.tertiaryContainer), dark: hexFromArgb(scheme.onTertiaryContainer), contrastText: hexFromArgb(scheme.onTertiary) },
    error: { main: hexFromArgb(scheme.error), light: hexFromArgb(scheme.errorContainer), dark: hexFromArgb(scheme.onErrorContainer), contrastText: hexFromArgb(scheme.onError) },
    background: { default: hexFromArgb(scheme.surface), paper: hexFromArgb(scheme.surfaceVariant) },
    text: { primary: hexFromArgb(scheme.onSurface), secondary: hexFromArgb(scheme.onSurfaceVariant) },
    divider: hexFromArgb(scheme.outline),
  }
}
// ---- End migration code ----

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
    // Surfaces
    '--color-surface': hexFromArgb(scheme.surface),
    '--color-surface-dim': hexFromArgb(scheme.surfaceDim ?? scheme.surface),
    '--color-surface-container': hexFromArgb(scheme.surfaceVariant),
    '--color-surface-bright': hexFromArgb(scheme.surfaceBright ?? scheme.surfaceVariant),

    // Text
    '--color-on-surface': hexFromArgb(scheme.onSurface),
    '--color-on-surface-muted': hexFromArgb(scheme.onSurfaceVariant),
    '--color-on-surface-dim': hexFromArgb(scheme.outline),

    // Primary
    '--color-primary': hexFromArgb(scheme.primary),
    '--color-on-primary': hexFromArgb(scheme.onPrimary),
    '--color-primary-container': hexFromArgb(scheme.primaryContainer),
    '--color-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),

    // Secondary
    '--color-secondary': hexFromArgb(scheme.secondary),
    '--color-on-secondary': hexFromArgb(scheme.onSecondary),

    // Error
    '--color-error': hexFromArgb(scheme.error),
    '--color-on-error': hexFromArgb(scheme.onError),

    // Status (fixed — not derived from seed)
    '--color-success': '#3ba55c',
    '--color-warning': '#faa61a',

    // Divider
    '--color-divider': hexFromArgb(scheme.outline),

    // Radius
    '--radius-xs': '2px',
    '--radius-sm': '5px',
    '--radius-md': '10px',
    '--radius-lg': '20px',
    '--radius-full': '100px',

    // Spacing
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

    // Transitions
    '--transition-fast': '150ms ease',
    '--transition-normal': '250ms ease',
    '--transition-slow': '350ms ease',

    // Z-index
    '--z-dropdown': '100',
    '--z-sticky': '200',
    '--z-overlay': '300',
    '--z-dialog': '400',
    '--z-snackbar': '500',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/colorUtils.ts
git commit -m "refactor: colorUtils 改為輸出 CSS 變數 map 取代 MUI palette"
```

---

### Task 4: Rewrite `ThemeProvider.tsx` — CSS Variable Injection

**Files:**
- Modify: `src/theme/ThemeProvider.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Rewrite `ThemeProvider.tsx` (keeps MUI wrapper during migration)**

During migration, the ThemeProvider wraps BOTH the MUI ThemeProvider (for existing MUI consumers) AND injects CSS variables (for new custom components). After all consumers are migrated in Chunk 5, Task 25 will remove the MUI wrapper.

```typescript
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

  // MUI theme (kept during migration, removed in Task 25)
  const muiTheme = useMemo(() => {
    const palette = generateMuiPalette(seedColor, mode)
    return createTheme({
      palette: { mode, ...palette },
      typography: { fontFamily: "'Noto Sans', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans JP', sans-serif" },
      shape: { borderRadius: 12 },
    })
  }, [mode, seedColor])

  // CSS variables for new custom components
  const cssVars = useMemo(
    () => generateCssVariables(seedColor, mode),
    [seedColor, mode],
  )

  // Inject CSS variables onto :root (including --font-primary on initial load)
  useEffect(() => {
    const root = document.documentElement
    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value)
    }
    // Set font on initial load too
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
```

- [ ] **Step 2: Update `src/main.tsx` — add reset.css import**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ThemeProvider from './theme/ThemeProvider'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/reset.css'
import './i18n'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add src/theme/ThemeProvider.tsx src/main.tsx
git commit -m "refactor: ThemeProvider 改為 CSS 變數注入，移除 MUI ThemeProvider/CssBaseline"
```

---

### Task 5: Create `useBreakpoint` Hook

**Files:**
- Create: `src/hooks/useBreakpoint.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const QUERIES = {
  desktop: '(min-width: 1025px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
} as const

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.matchMedia(QUERIES.desktop).matches) return 'desktop'
    if (window.matchMedia(QUERIES.tablet).matches) return 'tablet'
    return 'mobile'
  })

  useEffect(() => {
    const desktopMql = window.matchMedia(QUERIES.desktop)
    const tabletMql = window.matchMedia(QUERIES.tablet)

    const update = () => {
      if (desktopMql.matches) setBp('desktop')
      else if (tabletMql.matches) setBp('tablet')
      else setBp('mobile')
    }

    desktopMql.addEventListener('change', update)
    tabletMql.addEventListener('change', update)
    return () => {
      desktopMql.removeEventListener('change', update)
      tabletMql.removeEventListener('change', update)
    }
  }, [])

  return bp
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile'
}

export function useIsDesktop(): boolean {
  return useBreakpoint() === 'desktop'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useBreakpoint.ts
git commit -m "feat: 新增 useBreakpoint hook 取代 MUI useMediaQuery"
```

---

### Task 6: Create `useFocusTrap` Hook

**Files:**
- Create: `src/hooks/useFocusTrap.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !ref.current) return

    previousFocus.current = document.activeElement as HTMLElement

    const el = ref.current
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = focusables()[0]
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return

      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => {
      el.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus()
    }
  }, [active])

  return ref
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFocusTrap.ts
git commit -m "feat: 新增 useFocusTrap hook 用於 Dialog 焦點捕獲"
```

---

## Chunk 2: Atomic UI Components (ui/)

### Task 7: Create `Icon` Component

**Files:**
- Create: `src/components/ui/Icon.tsx`

- [ ] **Step 1: Create Icon component with Material Symbols + brand SVG support**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const brandSvgs: Record<string, string> = {
  github: '<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>',
  youtube: '<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
  x: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
}

interface IconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  'aria-label'?: string
}

export default function Icon({ name, size = 24, className, style, onClick, ...rest }: IconProps) {
  const brandSvg = brandSvgs[name]

  if (brandSvg) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        css={css`width: ${size}px; height: ${size}px; flex-shrink: 0;`}
        className={className}
        style={style}
        onClick={onClick}
        role={rest['aria-label'] ? 'img' : undefined}
        aria-label={rest['aria-label']}
      >
        <g dangerouslySetInnerHTML={{ __html: brandSvg }} />
      </svg>
    )
  }

  return (
    <span
      className={`material-symbols-outlined ${className ?? ''}`}
      css={css`
        font-size: ${size}px;
        width: ${size}px;
        height: ${size}px;
        line-height: 1;
        user-select: none;
        flex-shrink: 0;
      `}
      style={style}
      onClick={onClick}
      role={rest['aria-label'] ? 'img' : undefined}
      aria-label={rest['aria-label']}
      aria-hidden={!rest['aria-label']}
    >
      {name}
    </span>
  )
}
```

- [ ] **Step 2: Verify it renders**

Add `<Icon name="home" />` temporarily in `App.tsx`, run `npm run dev`, confirm icon shows.
Remove test code after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Icon.tsx
git commit -m "feat: 新增 Icon 元件 — Material Symbols + 品牌 SVG"
```

---

### Task 8: Create Layout Primitives (`Box`, `Stack`, `Container`, `Grid`)

**Files:**
- Create: `src/components/layout/Box.tsx`
- Create: `src/components/layout/Stack.tsx`
- Create: `src/components/layout/Container.tsx`
- Create: `src/components/layout/Grid.tsx`
- Create: `src/components/layout/index.ts`

- [ ] **Step 1: Create `Box.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes, ElementType } from 'react'
import { css } from '@emotion/react'

interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  display?: CSSProperties['display']
  flex?: CSSProperties['flex']
  flexDirection?: CSSProperties['flexDirection']
  alignItems?: CSSProperties['alignItems']
  justifyContent?: CSSProperties['justifyContent']
  gap?: string | number
  p?: string | number
  px?: string | number
  py?: string | number
  m?: string | number
  mx?: string | number
  my?: string | number
  mt?: string | number
  mb?: string | number
  ml?: string | number
  mr?: string | number
  width?: string | number
  height?: string | number
  minHeight?: string | number
  maxWidth?: string | number
  position?: CSSProperties['position']
  overflow?: CSSProperties['overflow']
  cursor?: CSSProperties['cursor']
  bg?: string
  color?: string
  borderRadius?: string | number
}

const Box = forwardRef<HTMLElement, BoxProps>(({
  as: Component = 'div', display, flex, flexDirection, alignItems, justifyContent,
  gap, p, px, py, m, mx, my, mt, mb, ml, mr,
  width, height, minHeight, maxWidth, position, overflow, cursor,
  bg, color, borderRadius, style, ...rest
}, ref) => {
  const styles = css({
    display, flex, flexDirection, alignItems, justifyContent,
    gap, padding: p, paddingInline: px, paddingBlock: py,
    margin: m, marginInline: mx, marginBlock: my,
    marginTop: mt, marginBottom: mb, marginLeft: ml, marginRight: mr,
    width, height, minHeight, maxWidth, position, overflow, cursor,
    background: bg, color, borderRadius,
  })

  return <Component ref={ref} css={styles} style={style} {...rest} />
})

Box.displayName = 'Box'
export default Box
```

- [ ] **Step 2: Create `Stack.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column'
  gap?: string | number
  align?: string
  justify?: string
  wrap?: boolean
  flex?: string | number
}

const Stack = forwardRef<HTMLDivElement, StackProps>(({
  direction = 'column', gap = 0, align, justify, wrap, flex, style, ...rest
}, ref) => {
  const styles = css({
    display: 'flex',
    flexDirection: direction,
    gap,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : undefined,
    flex,
  })
  return <div ref={ref} css={styles} style={style} {...rest} />
})

Stack.displayName = 'Stack'
export default Stack
```

- [ ] **Step 3: Create `Container.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: string | number
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(({
  maxWidth = 1156, style, ...rest
}, ref) => {
  const styles = css({
    width: '100%',
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    marginInline: 'auto',
    paddingInline: 'var(--spacing-5)',
  })
  return <div ref={ref} css={styles} style={style} {...rest} />
})

Container.displayName = 'Container'
export default Container
```

- [ ] **Step 4: Create `Grid.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: { xs?: number; sm?: number; md?: number; lg?: number }
  gap?: string | number
  minChildWidth?: string
}

const Grid = forwardRef<HTMLDivElement, GridProps>(({
  columns, gap = 'var(--spacing-4)', minChildWidth, style, ...rest
}, ref) => {
  const styles = minChildWidth
    ? css({
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minChildWidth}, 1fr))`,
        gap,
      })
    : css({
        display: 'grid',
        gridTemplateColumns: `repeat(${columns?.xs ?? 1}, 1fr)`,
        gap,
        '@media (min-width: 600px)': columns?.sm
          ? { gridTemplateColumns: `repeat(${columns.sm}, 1fr)` }
          : undefined,
        '@media (min-width: 769px)': columns?.md
          ? { gridTemplateColumns: `repeat(${columns.md}, 1fr)` }
          : undefined,
        '@media (min-width: 1025px)': columns?.lg
          ? { gridTemplateColumns: `repeat(${columns.lg}, 1fr)` }
          : undefined,
      })

  return <div ref={ref} css={styles} style={style} {...rest} />
})

Grid.displayName = 'Grid'
export default Grid
```

- [ ] **Step 5: Create `index.ts` barrel export**

```typescript
export { default as Box } from './Box'
export { default as Stack } from './Stack'
export { default as Container } from './Container'
export { default as Grid } from './Grid'
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/
git commit -m "feat: 新增 layout 元件 — Box, Stack, Container, Grid"
```

---

### Task 9: Create `Button` Component

**Files:**
- Create: `src/components/ui/Button.tsx`

- [ ] **Step 1: Create Button with all variants**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { css } from '@emotion/react'
import Icon from './Icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'fab'
type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  startIcon?: string
  endIcon?: string
  fullWidth?: boolean
}

const sizeMap = {
  small: { fontSize: 12, px: 12, py: 4, iconSize: 16 },
  medium: { fontSize: 14, px: 16, py: 8, iconSize: 20 },
  large: { fontSize: 16, px: 24, py: 12, iconSize: 24 },
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'medium', startIcon, endIcon,
  fullWidth, children, disabled, ...rest
}, ref) => {
  const s = sizeMap[size]

  const base = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-2)',
    fontFamily: 'var(--font-primary)',
    fontSize: s.fontSize,
    fontWeight: 600,
    lineHeight: 1,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'var(--transition-fast)',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : undefined,
    textDecoration: 'none',
  })

  const variants: Record<ButtonVariant, ReturnType<typeof css>> = {
    primary: css({
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      borderRadius: 'var(--radius-xs)',
      padding: `${s.py}px ${s.px}px`,
      '&:hover:not(:disabled)': { filter: 'brightness(0.85)' },
    }),
    secondary: css({
      background: 'var(--color-surface-bright)',
      color: 'var(--color-on-surface)',
      borderRadius: 'var(--radius-sm)',
      padding: `${s.py}px ${s.px}px`,
      '&:hover:not(:disabled)': { filter: 'brightness(1.15)' },
    }),
    ghost: css({
      background: 'transparent',
      color: 'var(--color-on-surface-muted)',
      borderRadius: 'var(--radius-sm)',
      padding: `${s.py}px ${s.px}px`,
      '&:hover:not(:disabled)': { background: 'var(--color-surface-container)' },
    }),
    icon: css({
      background: 'transparent',
      color: 'var(--color-on-surface-muted)',
      borderRadius: 'var(--radius-full)',
      padding: s.py + 4,
      '&:hover:not(:disabled)': { background: 'var(--color-surface-container)' },
    }),
    fab: css({
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      borderRadius: 'var(--radius-full)',
      padding: 16,
      position: 'fixed',
      bottom: 'var(--spacing-6)',
      right: 'var(--spacing-6)',
      zIndex: 'var(--z-sticky)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      '&:hover:not(:disabled)': { filter: 'brightness(0.85)' },
      '@media (max-width: 768px)': {
        bottom: 'calc(56px + var(--spacing-4))',
      },
    }),
  }

  return (
    <button ref={ref} css={[base, variants[variant]]} disabled={disabled} {...rest}>
      {startIcon && <Icon name={startIcon} size={s.iconSize} />}
      {children}
      {endIcon && <Icon name={endIcon} size={s.iconSize} />}
    </button>
  )
})

Button.displayName = 'Button'
export default Button
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat: 新增 Button 元件 — primary/secondary/ghost/icon/fab 變體"
```

---

### Task 10: Create `Card`, `Divider`, `Avatar`, `Chip` Components

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Divider.tsx`
- Create: `src/components/ui/Avatar.tsx`
- Create: `src/components/ui/Chip.tsx`

- [ ] **Step 1: Create `Card.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'container'
  radius?: 'sm' | 'md' | 'lg'
  padding?: string | number
  clickable?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'surface', radius = 'md', padding = 'var(--spacing-4)',
  clickable, style, ...rest
}, ref) => {
  const styles = css({
    background: variant === 'surface' ? 'var(--color-surface)' : 'var(--color-surface-container)',
    borderRadius: `var(--radius-${radius})`,
    padding,
    cursor: clickable ? 'pointer' : undefined,
    transition: clickable ? 'var(--transition-fast)' : undefined,
    '&:hover': clickable ? { filter: 'brightness(1.08)' } : undefined,
  })

  return <div ref={ref} css={styles} style={style} {...rest} />
})

Card.displayName = 'Card'
export default Card
```

- [ ] **Step 2: Create `Divider.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface DividerProps {
  vertical?: boolean
  spacing?: string | number
  width?: string | number
}

export default function Divider({ vertical, spacing = 'var(--spacing-2)', width }: DividerProps) {
  const styles = vertical
    ? css({
        width: 1,
        height: width ?? '100%',
        background: 'var(--color-divider)',
        marginInline: spacing,
        flexShrink: 0,
      })
    : css({
        height: 1,
        width: width ?? '100%',
        background: 'var(--color-divider)',
        marginBlock: spacing,
        flexShrink: 0,
      })

  return <hr css={styles} />
}
```

- [ ] **Step 3: Create `Avatar.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: number
  fallback?: string
  status?: 'online' | 'idle' | 'dnd' | 'offline'
  bg?: string
  onClick?: () => void
  className?: string
}

const statusColors: Record<string, string> = {
  online: '#3ba55c',
  idle: '#faa61a',
  dnd: '#ed4245',
  offline: '#72767d',
}

export default function Avatar({
  src, alt, size = 40, fallback, status, bg, onClick, className,
}: AvatarProps) {
  const initials = fallback ?? alt?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div
      css={css({
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : undefined,
      })}
      className={className}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          css={css({
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
          })}
        />
      ) : (
        <div
          css={css({
            width: size,
            height: size,
            borderRadius: '50%',
            background: bg ?? 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            fontWeight: 700,
            userSelect: 'none',
          })}
        >
          {initials}
        </div>
      )}
      {status && (
        <div
          css={css({
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: '50%',
            background: statusColors[status],
            border: '2px solid var(--color-surface)',
          })}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `Chip.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Icon from './Icon'

interface ChipProps {
  label: string
  color?: string
  bg?: string
  icon?: string
  onDelete?: () => void
  onClick?: () => void
  size?: 'small' | 'medium'
  variant?: 'filled' | 'outlined'
}

export default function Chip({
  label, color, bg, icon, onDelete, onClick, size = 'medium', variant = 'filled',
}: ChipProps) {
  const isSmall = size === 'small'
  const styles = css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
    padding: isSmall ? '2px 8px' : '4px 12px',
    borderRadius: 'var(--radius-full)',
    fontSize: isSmall ? 11 : 13,
    fontWeight: 500,
    lineHeight: 1.4,
    cursor: onClick ? 'pointer' : undefined,
    transition: 'var(--transition-fast)',
    whiteSpace: 'nowrap',
    ...(variant === 'filled'
      ? {
          background: bg ?? 'var(--color-surface-bright)',
          color: color ?? 'var(--color-on-surface)',
        }
      : {
          background: 'transparent',
          color: color ?? 'var(--color-on-surface)',
          border: `1px solid ${color ?? 'var(--color-divider)'}`,
        }),
    '&:hover': onClick ? { filter: 'brightness(1.15)' } : undefined,
  })

  return (
    <span css={styles} onClick={onClick}>
      {icon && <Icon name={icon} size={isSmall ? 14 : 16} />}
      {label}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          css={css({
            display: 'flex', padding: 0, cursor: 'pointer',
            color: 'inherit', opacity: 0.7, '&:hover': { opacity: 1 },
          })}
          aria-label="Remove"
        >
          <Icon name="close" size={isSmall ? 14 : 16} />
        </button>
      )}
    </span>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Divider.tsx src/components/ui/Avatar.tsx src/components/ui/Chip.tsx
git commit -m "feat: 新增 Card, Divider, Avatar, Chip 元件"
```

---

### Task 11: Create Form Components (`TextField`, `Select`, `Checkbox`, `Switch`)

**Files:**
- Create: `src/components/ui/TextField.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Checkbox.tsx`
- Create: `src/components/ui/Switch.tsx`

- [ ] **Step 1: Create `TextField.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  multiline?: boolean
  rows?: number
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(({
  label, error, helperText, fullWidth, multiline, rows = 3,
  startAdornment, endAdornment, id, ...rest
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  const wrapper = css({
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-1)',
    width: fullWidth ? '100%' : undefined,
  })

  const inputWrapper = css({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-divider)'}`,
    padding: '8px 12px',
    transition: 'var(--transition-fast)',
    '&:focus-within': {
      borderColor: error ? 'var(--color-error)' : 'var(--color-primary)',
    },
  })

  const inputStyle = css({
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--color-on-surface)',
    fontSize: 14,
    fontFamily: 'var(--font-primary)',
    '&::placeholder': { color: 'var(--color-on-surface-dim)' },
    resize: multiline ? 'vertical' : undefined,
  })

  return (
    <div css={wrapper}>
      {label && (
        <label htmlFor={inputId} css={css({ fontSize: 13, fontWeight: 500, color: error ? 'var(--color-error)' : 'var(--color-on-surface-muted)' })}>
          {label}
        </label>
      )}
      <div css={inputWrapper}>
        {startAdornment}
        {multiline ? (
          <textarea ref={ref as any} id={inputId} rows={rows} css={inputStyle} {...rest as any} />
        ) : (
          <input ref={ref} id={inputId} css={inputStyle} {...rest} />
        )}
        {endAdornment}
      </div>
      {(error || helperText) && (
        <span css={css({ fontSize: 12, color: error ? 'var(--color-error)' : 'var(--color-on-surface-dim)' })}>
          {error || helperText}
        </span>
      )}
    </div>
  )
})

TextField.displayName = 'TextField'
export default TextField
```

- [ ] **Step 2: Create `Select.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { css } from '@emotion/react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  fullWidth?: boolean
  error?: string
}

export default function Select({ label, value, onChange, options, fullWidth, error }: SelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })

    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) }
  }

  return (
    <div css={css({ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', width: fullWidth ? '100%' : undefined })}>
      {label && <label css={css({ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface-muted)' })}>{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        css={css({
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-surface)', color: 'var(--color-on-surface)',
          border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-divider)'}`,
          borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 14,
          cursor: 'pointer', textAlign: 'left', width: '100%',
        })}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected?.label ?? ''}</span>
        <span className="material-symbols-outlined" css={css({ fontSize: 20, transition: 'var(--transition-fast)', transform: open ? 'rotate(180deg)' : undefined })}>
          expand_more
        </span>
      </button>
      {error && <span css={css({ fontSize: 12, color: 'var(--color-error)' })}>{error}</span>}
      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          css={css({
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
            background: 'var(--color-surface-container)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-divider)', zIndex: 'var(--z-dropdown)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxHeight: 240, overflowY: 'auto',
            padding: 'var(--spacing-1) 0',
          })}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              css={css({
                padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                color: 'var(--color-on-surface)',
                background: opt.value === value ? 'var(--color-surface-bright)' : 'transparent',
                '&:hover': { background: 'var(--color-surface-bright)' },
              })}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `Checkbox.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Icon from './Icon'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export default function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  return (
    <label css={css({
      display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-2)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    })}>
      <div css={css({
        width: 20, height: 20, borderRadius: 'var(--radius-xs)',
        border: `2px solid ${checked ? 'var(--color-primary)' : 'var(--color-divider)'}`,
        background: checked ? 'var(--color-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'var(--transition-fast)',
      })}>
        {checked && <Icon name="check" size={14} style={{ color: 'var(--color-on-primary)' }} />}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        css={css({ position: 'absolute', opacity: 0, width: 0, height: 0 })}
      />
      {label && <span css={css({ fontSize: 14, color: 'var(--color-on-surface)' })}>{label}</span>}
    </label>
  )
}
```

- [ ] **Step 4: Create `Switch.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export default function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label css={css({
      display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-2)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    })}>
      <div css={css({
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-bright)',
        position: 'relative', transition: 'var(--transition-fast)',
      })}>
        <div css={css({
          width: 18, height: 18, borderRadius: '50%',
          background: '#ffffff', position: 'absolute', top: 2,
          left: checked ? 20 : 2, transition: 'var(--transition-fast)',
        })} />
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        css={css({ position: 'absolute', opacity: 0, width: 0, height: 0 })}
      />
      {label && <span css={css({ fontSize: 14, color: 'var(--color-on-surface)' })}>{label}</span>}
    </label>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/TextField.tsx src/components/ui/Select.tsx src/components/ui/Checkbox.tsx src/components/ui/Switch.tsx
git commit -m "feat: 新增表單元件 — TextField, Select, Checkbox, Switch"
```

---

### Task 12: Create Feedback/Status Components (`Dialog`, `Snackbar`, `Alert`, `Skeleton`, `CircularProgress`, `LinearProgress`, `Tooltip`, `Tabs`, `Table`, `Menu`)

**Files:**
- Create: `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/Snackbar.tsx`
- Create: `src/components/ui/Alert.tsx`
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/CircularProgress.tsx`
- Create: `src/components/ui/LinearProgress.tsx`
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/ui/Tabs.tsx`
- Create: `src/components/ui/Table.tsx`
- Create: `src/components/ui/Menu.tsx`
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create `Dialog.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { css, keyframes } from '@emotion/react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  actions?: React.ReactNode
  maxWidth?: string | number
}

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`
const slideUp = keyframes`from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 }`

export default function Dialog({ open, onClose, title, children, actions, maxWidth = 480 }: DialogProps) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      css={css({
        position: 'fixed', inset: 0, zIndex: 'var(--z-dialog)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--spacing-4)',
      })}
    >
      <div
        css={css({ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', animation: `${fadeIn} 150ms ease` })}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        css={css({
          position: 'relative',
          background: 'var(--color-surface-container)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-6)',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: `${slideUp} 250ms ease`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-4)',
        })}
      >
        {title && <h2 css={css({ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' })}>{title}</h2>}
        <div css={css({ flex: 1 })}>{children}</div>
        {actions && <div css={css({ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' })}>{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Create `Snackbar.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { css, keyframes } from '@emotion/react'

interface SnackbarProps {
  open: boolean
  onClose: () => void
  message: string
  autoHideDuration?: number
  action?: React.ReactNode
}

const slideIn = keyframes`from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 }`

export default function Snackbar({ open, onClose, message, autoHideDuration = 4000, action }: SnackbarProps) {
  useEffect(() => {
    if (!open || autoHideDuration <= 0) return
    const timer = setTimeout(onClose, autoHideDuration)
    return () => clearTimeout(timer)
  }, [open, onClose, autoHideDuration])

  if (!open) return null

  return createPortal(
    <div css={css({
      position: 'fixed', bottom: 'var(--spacing-6)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 'var(--z-snackbar)', animation: `${slideIn} 250ms ease`,
      background: 'var(--color-surface-container)', color: 'var(--color-on-surface)',
      borderRadius: 'var(--radius-sm)', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxWidth: '90vw',
      fontSize: 14,
      '@media (max-width: 768px)': { bottom: 'calc(56px + var(--spacing-4))' },
    })}>
      <span css={css({ flex: 1 })}>{message}</span>
      {action}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 3: Create `Alert.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Icon from './Icon'

interface AlertProps {
  severity: 'success' | 'error' | 'warning' | 'info'
  children: React.ReactNode
  onClose?: () => void
}

const iconMap = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' }
const colorMap = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-primary)',
}

export default function Alert({ severity, children, onClose }: AlertProps) {
  return (
    <div role="alert" css={css({
      display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)',
      padding: '12px 16px', borderRadius: 'var(--radius-sm)',
      background: 'var(--color-surface)', border: `1px solid ${colorMap[severity]}`,
      color: 'var(--color-on-surface)', fontSize: 14,
    })}>
      <Icon name={iconMap[severity]} size={20} style={{ color: colorMap[severity] }} />
      <span css={css({ flex: 1 })}>{children}</span>
      {onClose && (
        <button onClick={onClose} css={css({ display: 'flex', color: 'var(--color-on-surface-muted)', '&:hover': { color: 'var(--color-on-surface)' } })} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `Skeleton.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

const pulse = keyframes`
  0% { opacity: 0.6 }
  50% { opacity: 0.3 }
  100% { opacity: 0.6 }
`

interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'rectangular' | 'circular' | 'text'
  borderRadius?: string | number
}

export default function Skeleton({ width = '100%', height = 20, variant = 'rectangular', borderRadius }: SkeletonProps) {
  return (
    <div css={css({
      width,
      height: variant === 'text' ? '1em' : height,
      borderRadius: variant === 'circular' ? '50%' : (borderRadius ?? 'var(--radius-sm)'),
      background: 'var(--color-surface-bright)',
      animation: `${pulse} 1.5s ease-in-out infinite`,
    })} />
  )
}
```

- [ ] **Step 5: Create `CircularProgress.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

const spin = keyframes`from { transform: rotate(0deg) } to { transform: rotate(360deg) }`

interface CircularProgressProps {
  size?: number
  color?: string
}

export default function CircularProgress({ size = 40, color = 'var(--color-primary)' }: CircularProgressProps) {
  const stroke = Math.max(2, size / 10)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      css={css({ animation: `${spin} 1s linear infinite` })}
      role="progressbar"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round"
      />
    </svg>
  )
}
```

- [ ] **Step 6: Create `LinearProgress.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

const indeterminate = keyframes`
  0% { transform: translateX(-100%) }
  100% { transform: translateX(200%) }
`

interface LinearProgressProps {
  value?: number
  color?: string
}

export default function LinearProgress({ value, color = 'var(--color-primary)' }: LinearProgressProps) {
  const isIndeterminate = value === undefined

  return (
    <div css={css({
      width: '100%', height: 4, borderRadius: 2,
      background: 'var(--color-surface-bright)', overflow: 'hidden',
    })} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div css={css({
        height: '100%', borderRadius: 2, background: color,
        width: isIndeterminate ? '50%' : `${value}%`,
        transition: isIndeterminate ? undefined : 'var(--transition-normal)',
        animation: isIndeterminate ? `${indeterminate} 1.5s ease-in-out infinite` : undefined,
      })} />
    </div>
  )
}
```

- [ ] **Step 7: Create `Tooltip.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { css, keyframes } from '@emotion/react'

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`

interface TooltipProps {
  title: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
}

export default function Tooltip({ title, placement = 'top', children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const handleEnter = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const offset = 8
    const positions = {
      top: { top: rect.top - offset, left: rect.left + rect.width / 2 },
      bottom: { top: rect.bottom + offset, left: rect.left + rect.width / 2 },
      left: { top: rect.top + rect.height / 2, left: rect.left - offset },
      right: { top: rect.top + rect.height / 2, left: rect.right + offset },
    }
    setPos(positions[placement])
    setShow(true)
  }

  const transform = {
    top: 'translate(-50%, -100%)', bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)', right: 'translate(0, -50%)',
  }

  return (
    <>
      <span ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}
        onFocus={handleEnter} onBlur={() => setShow(false)} css={css({ display: 'inline-flex' })}>
        {children}
      </span>
      {show && title && createPortal(
        <div role="tooltip" css={css({
          position: 'fixed', top: pos.top, left: pos.left, transform: transform[placement],
          background: '#18191c', color: '#dcddde', padding: '6px 10px',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
          zIndex: 'var(--z-dropdown)', pointerEvents: 'none', whiteSpace: 'nowrap',
          animation: `${fadeIn} 100ms ease`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        })}>
          {title}
        </div>,
        document.body,
      )}
    </>
  )
}
```

- [ ] **Step 8: Create `Tabs.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface Tab {
  label: string
  value: string | number
}

interface TabsProps {
  tabs: Tab[]
  value: string | number
  onChange: (value: string | number) => void
}

export default function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div role="tablist" css={css({
      display: 'flex', borderBottom: '2px solid var(--color-surface-bright)',
      gap: 'var(--spacing-1)', overflow: 'auto',
    })}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            css={css({
              padding: '10px 16px', fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? 'var(--color-primary)' : 'var(--color-on-surface-muted)',
              borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: -2, transition: 'var(--transition-fast)', whiteSpace: 'nowrap',
              '&:hover': { color: 'var(--color-on-surface)' },
            })}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 9: Create `Table.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  width?: string | number
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
}

export default function Table<T>({ columns, data, keyExtractor, onRowClick }: TableProps<T>) {
  return (
    <div css={css({ overflowX: 'auto', borderRadius: 'var(--radius-md)' })}>
      <table css={css({
        width: '100%', borderCollapse: 'collapse', fontSize: 14,
        color: 'var(--color-on-surface)',
      })}>
        <thead>
          <tr css={css({ borderBottom: '1px solid var(--color-divider)' })}>
            {columns.map((col) => (
              <th key={col.key} css={css({
                textAlign: 'left', padding: '12px 16px', fontWeight: 600, fontSize: 13,
                color: 'var(--color-on-surface-muted)', width: col.width,
              })}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              css={css({
                borderBottom: '1px solid var(--color-surface-bright)',
                background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-container)',
                cursor: onRowClick ? 'pointer' : undefined,
                transition: 'var(--transition-fast)',
                '&:hover': onRowClick ? { background: 'var(--color-surface-bright)' } : undefined,
              })}
            >
              {columns.map((col) => (
                <td key={col.key} css={css({ padding: '12px 16px' })}>
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 10: Create `Menu.tsx`**

```tsx
/** @jsxImportSource @emotion/react */
import { useState, useRef, useEffect, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import { css } from '@emotion/react'
import Icon from './Icon'

interface MenuItemDef {
  label: string
  icon?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface MenuProps {
  trigger: React.ReactElement
  items: MenuItemDef[]
}

export default function Menu({ trigger, items }: MenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right })

    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      {cloneElement(trigger, { ref: triggerRef, onClick: () => setOpen(!open) })}
      {open && createPortal(
        <div ref={menuRef} role="menu" css={css({
          position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)',
          background: 'var(--color-surface-container)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-divider)', zIndex: 'var(--z-dropdown)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)', padding: 'var(--spacing-1) 0',
          minWidth: 160,
        })}>
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { item.onClick(); setOpen(false) }}
              css={css({
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)',
                width: '100%', padding: '8px 12px', fontSize: 14, textAlign: 'left',
                color: item.danger ? 'var(--color-error)' : 'var(--color-on-surface)',
                opacity: item.disabled ? 0.5 : 1,
                '&:hover:not(:disabled)': { background: 'var(--color-surface-bright)' },
              })}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
```

- [ ] **Step 11: Create `src/components/ui/index.ts` barrel export**

```typescript
export { default as Icon } from './Icon'
export { default as Button } from './Button'
export { default as Card } from './Card'
export { default as Dialog } from './Dialog'
export { default as TextField } from './TextField'
export { default as Select } from './Select'
export { default as Chip } from './Chip'
export { default as Avatar } from './Avatar'
export { default as Tabs } from './Tabs'
export { default as Table } from './Table'
export { default as Skeleton } from './Skeleton'
export { default as Snackbar } from './Snackbar'
export { default as Switch } from './Switch'
export { default as Checkbox } from './Checkbox'
export { default as LinearProgress } from './LinearProgress'
export { default as CircularProgress } from './CircularProgress'
export { default as Tooltip } from './Tooltip'
export { default as Menu } from './Menu'
export { default as Alert } from './Alert'
export { default as Divider } from './Divider'
```

- [ ] **Step 12: Verify build compiles**

Run: `npm run build`
Expected: No TypeScript errors, clean build.

- [ ] **Step 13: Commit**

```bash
git add src/components/ui/
git commit -m "feat: 新增所有 UI 原子元件 — Dialog, Snackbar, Alert, Skeleton, Progress, Tooltip, Tabs, Table, Menu"
```

---

## Chunk 3: Navigation & Layout Components

### Task 13: Rewrite `NavRail.tsx`

**Files:**
- Modify: `src/components/NavRail.tsx`

- [ ] **Step 1: Rewrite NavRail removing all MUI imports**

Replace the entire file. Use `Icon` component with Material Symbol names instead of MUI icon components. Replace `Box`, `IconButton`, `Tooltip`, `Divider`, `Avatar` with custom equivalents. Replace `alpha` import with CSS `filter: brightness()`. Keep `USER_NAV` and `ADMIN_NAV` exports but change `icon` field from `ElementType` to `string` (icon name).

Key changes:
- `NavItem.icon` becomes `string` (e.g., `'home'`, `'group'`)
- `USER_NAV` and `ADMIN_NAV` use icon names: `home`, `group`, `event`, `checklist`, `campaign`, `sports_esports`, `feedback`, `dashboard`, `shield`, `manage_accounts`, `confirmation_number`, `rate_review`, `settings`
- Styling via Emotion `css` prop using CSS variables
- Sidebar: 72px wide, fixed, `--color-surface` background

- [ ] **Step 2: Verify NavRail renders**

Run `npm run dev`, navigate to `/home`, check desktop sidebar shows.

- [ ] **Step 3: Commit**

```bash
git add src/components/NavRail.tsx
git commit -m "refactor: NavRail 移除 MUI，改用自建 Icon/Tooltip/Avatar"
```

---

### Task 14: Rewrite `NavDrawer.tsx`

**Files:**
- Modify: `src/components/NavDrawer.tsx`

- [ ] **Step 1: Rewrite NavDrawer as sliding drawer panel**

Replace MUI `Drawer`, `List`, `ListItemButton`, `ListItemIcon`, `ListItemText` with custom styled div. Import `USER_NAV`, `ADMIN_NAV` from NavRail. Use `createPortal` for overlay.

- [ ] **Step 2: Commit**

```bash
git add src/components/NavDrawer.tsx
git commit -m "refactor: NavDrawer 移除 MUI，改用自建滑動面板"
```

---

### Task 15: Rewrite `TopAppBar.tsx`

**Files:**
- Modify: `src/components/TopAppBar.tsx`

- [ ] **Step 1: Rewrite TopAppBar removing MUI AppBar/Toolbar/IconButton**

Replace with fixed-position header div. Use custom `Icon`, `Avatar`, `Menu` components.

- [ ] **Step 2: Commit**

```bash
git add src/components/TopAppBar.tsx
git commit -m "refactor: TopAppBar 移除 MUI，改用自建元件"
```

---

### Task 16: Create `BottomNav.tsx` + Rewrite `AppLayout.tsx`

**Files:**
- Create: `src/components/BottomNav.tsx`
- Modify: `src/layouts/AppLayout.tsx`

- [ ] **Step 1: Create `BottomNav.tsx`**

Fixed bottom bar with 5 nav items. Use `Icon` component. Show labels below icons. Active item highlighted with `--color-primary`.

- [ ] **Step 2: Rewrite `AppLayout.tsx`**

Remove all MUI imports (`Box`, `BottomNavigation`, `BottomNavigationAction`, `SvgIconComponent`). Replace `SvgIconComponent` type with `string` for icon names. Use custom layout div, `useBreakpoint()` for responsive behavior.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.tsx src/layouts/AppLayout.tsx
git commit -m "feat: 新增 BottomNav + 重寫 AppLayout 移除 MUI"
```

---

### Task 17: Rewrite `PublicLayout.tsx`

**Files:**
- Modify: `src/layouts/PublicLayout.tsx`

- [ ] **Step 1: Rewrite PublicLayout removing MUI AppBar/Toolbar/Typography/IconButton/Button/Avatar**

Use custom components and Emotion styling.

- [ ] **Step 2: Commit**

```bash
git add src/layouts/PublicLayout.tsx
git commit -m "refactor: PublicLayout 移除 MUI，改用自建元件"
```

---

## Chunk 4: Rewrite All Remaining Components (src/components/)

### Task 18: Rewrite utility components (`LanguageSelector`, `ThemeColorPicker`, `ProtectedRoute`, `ErrorBoundary`)

**Files:**
- Modify: `src/components/LanguageSelector.tsx`
- Modify: `src/components/ThemeColorPicker.tsx`
- Modify: `src/components/ProtectedRoute.tsx`
- Modify: `src/components/ErrorBoundary.tsx` (likely no MUI, verify)

- [ ] **Step 1: Rewrite each file, replacing MUI imports with custom ui/ components**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git add src/components/LanguageSelector.tsx src/components/ThemeColorPicker.tsx src/components/ProtectedRoute.tsx
git commit -m "refactor: 工具元件移除 MUI — LanguageSelector, ThemeColorPicker, ProtectedRoute"
```

---

### Task 19: Rewrite Member components

**Files:**
- Modify: `src/components/MemberCard.tsx`
- Modify: `src/components/MemberDialog.tsx`

- [ ] **Step 1: Rewrite `MemberCard.tsx`**

Replace MUI `Card`, `CardActionArea`, `CardContent`, `Avatar`, `Chip`, `Stack` with custom `Card`, `Avatar`, `Chip` from `ui/`. Replace `<Typography>` with `<span>`, `<p>`. Use `css` prop for all styling.

- [ ] **Step 2: Rewrite `MemberDialog.tsx`**

Replace MUI `Dialog`, `Avatar`, `Typography`, `Chip`, `TextField`, `Divider` with custom equivalents. Replace `GitHubIcon`, `BrushIcon`, `LinkIcon`, `DeleteIcon` with `<Icon name="github">`, `<Icon name="brush">`, etc.

- [ ] **Step 3: Verify build + Commit**

```bash
npm run build && git add src/components/MemberCard.tsx src/components/MemberDialog.tsx && git commit -m "refactor: MemberCard/Dialog 移除 MUI"
```

---

### Task 20: Rewrite Announcement components

**Files:**
- Modify: `src/components/AnnouncementCard.tsx`
- Modify: `src/components/AnnouncementDialog.tsx`

- [ ] **Step 1: Rewrite both files**

AnnouncementCard: Replace `Card`, `CardContent`, `Avatar`, `Chip`, `IconButton` → custom. Icons: `push_pin`, `edit`, `delete`.
AnnouncementDialog: Replace `Dialog`, `TextField`, `Switch` → custom.

- [ ] **Step 2: Verify build + Commit**

```bash
npm run build && git add src/components/AnnouncementCard.tsx src/components/AnnouncementDialog.tsx && git commit -m "refactor: AnnouncementCard/Dialog 移除 MUI"
```

---

### Task 21: Rewrite Feedback components

**Files:**
- Modify: `src/components/FeedbackCard.tsx`
- Modify: `src/components/FeedbackDialog.tsx`

- [ ] **Step 1: Rewrite both files**

FeedbackCard: Replace `Card`, `Chip`, `Select`. Icons: `thumb_up`, `delete`.
FeedbackDialog: Replace `Dialog`, `TextField`, `MenuItem`.

- [ ] **Step 2: Verify build + Commit**

```bash
npm run build && git add src/components/FeedbackCard.tsx src/components/FeedbackDialog.tsx && git commit -m "refactor: FeedbackCard/Dialog 移除 MUI"
```

---

### Task 22: Rewrite Game components

**Files:**
- Modify: `src/components/GameInviteCard.tsx`
- Modify: `src/components/GameInviteDialog.tsx`
- Modify: `src/components/LeaderboardDialog.tsx`
- Modify: `src/components/GameBoard2048.tsx`

- [ ] **Step 1: Rewrite GameInviteCard/Dialog**

Icons: `group`, `sports_esports`. Replace MUI `Card`, `Chip`, `Avatar`, `Button`, `Dialog`, `TextField`, `MenuItem`.

- [ ] **Step 2: Rewrite LeaderboardDialog**

Replace MUI `Dialog`, `Table`, `TableBody`, `TableCell`, `TableContainer`, `TableHead` → custom `Dialog` + `Table`.

- [ ] **Step 3: Rewrite GameBoard2048**

Replace MUI `Box`, `Typography`, `Button`, `useTheme` → Emotion `css` prop + CSS variables. Game logic stays unchanged.

- [ ] **Step 4: Verify build + Commit**

```bash
npm run build && git add src/components/GameInviteCard.tsx src/components/GameInviteDialog.tsx src/components/LeaderboardDialog.tsx src/components/GameBoard2048.tsx && git commit -m "refactor: 遊戲相關元件移除 MUI"
```

---

### Task 23: Rewrite remaining components (`LevelCard`, `TodoItem`, `ProfileEditor`)

**Files:**
- Modify: `src/components/LevelCard.tsx`
- Modify: `src/components/TodoItem.tsx`
- Modify: `src/components/ProfileEditor.tsx`

- [ ] **Step 1: Rewrite `LevelCard.tsx`**

Replace `Card`, `CardContent`, `Typography`, `Chip`, `LinearProgress`, `Button`. Icons: `emoji_events`, `leaderboard`.

- [ ] **Step 2: Rewrite `TodoItem.tsx`**

Replace `ListItem`, `ListItemIcon`, `ListItemText`, `IconButton`, `Checkbox`. Icons: `delete`.

- [ ] **Step 3: Rewrite `ProfileEditor.tsx`**

Replace `Card`, `CardContent`, `TextField`, `Autocomplete`, `Switch`, `Button`, `Stack`, `Snackbar`. Icons: `save`, `brush`, `github`, `youtube`, `x`, `link`.

Note: MUI `Autocomplete` has no direct custom replacement. Convert to a `TextField` with suggestions dropdown or simplify to a `Select` if the options are fixed.

- [ ] **Step 4: Verify build + Commit**

```bash
npm run build && git add src/components/LevelCard.tsx src/components/TodoItem.tsx src/components/ProfileEditor.tsx && git commit -m "refactor: LevelCard/TodoItem/ProfileEditor 移除 MUI"
```

---

### Task 24: Rewrite admin components

**Files:**
- Modify: `src/components/admin/AuditLogTable.tsx`
- Modify: `src/components/admin/RoleDialog.tsx`
- Modify: `src/components/admin/TicketCreateDialog.tsx`
- Modify: `src/components/admin/TicketDetailDialog.tsx`
- Modify: `src/components/admin/UserActionDialog.tsx`

- [ ] **Step 1: Rewrite each admin component replacing MUI with custom ui/ components**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/
git commit -m "refactor: 管理後台元件移除 MUI"
```

---

## Chunk 5: Rewrite All Pages

### Task 25: Rewrite `Home.tsx` (Figma-aligned)

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Rewrite Home.tsx**

Replace all MUI `Box`, `Typography`, `Skeleton`, `Button`, `IconButton` with custom components and Emotion `css` prop. Use `<Icon name="view_list">`, `<Icon name="grid_view">`, `<Icon name="chevron_left">`, `<Icon name="chevron_right">`.

Keep all existing logic (carousel, pagination, events). Only change the rendering layer.

- [ ] **Step 2: Verify visually matches Figma**
- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "refactor: Home 頁面移除 MUI，對齊 Figma 設計"
```

---

### Task 26: Rewrite `Landing.tsx`

**Files:**
- Modify: `src/pages/Landing.tsx`

- [ ] **Step 1: Rewrite Landing.tsx removing all MUI**
- [ ] **Step 2: Commit**

```bash
git add src/pages/Landing.tsx
git commit -m "refactor: Landing 頁面移除 MUI"
```

---

### Task 27: Rewrite remaining user pages (`Members`, `Events`, `Profile`, `Announcements`, `Todos`, `Games`, `Feedback`, `AuthCallback`)

**Files:**
- Modify: `src/pages/Members.tsx`
- Modify: `src/pages/Events.tsx`
- Modify: `src/pages/Profile.tsx`
- Modify: `src/pages/Announcements.tsx`
- Modify: `src/pages/Todos.tsx`
- Modify: `src/pages/Games.tsx`
- Modify: `src/pages/Feedback.tsx`
- Modify: `src/pages/AuthCallback.tsx`

- [ ] **Step 1-8: Rewrite each page file**

For each page:
- Replace MUI component imports with `src/components/ui/` and `src/components/layout/`
- Replace `sx` props with Emotion `css` prop
- Replace MUI icons with `<Icon name="xxx" />`
- Replace `<Typography>` with semantic HTML (`<h1>`, `<p>`, `<span>`) + CSS

- [ ] **Step 9: Verify build**
- [ ] **Step 10: Commit**

```bash
git add src/pages/
git commit -m "refactor: 所有使用者頁面移除 MUI"
```

---

### Task 28: Rewrite admin pages

**Files:**
- Modify: `src/pages/admin/Overview.tsx`
- Modify: `src/pages/admin/Roles.tsx`
- Modify: `src/pages/admin/Users.tsx`
- Modify: `src/pages/admin/Tickets.tsx`
- Modify: `src/pages/admin/FeedbackReview.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] **Step 1-6: Rewrite each admin page**
- [ ] **Step 7: Verify build**
- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/
git commit -m "refactor: 管理後台頁面移除 MUI"
```

---

## Chunk 6: Cleanup & Final Verification

### Task 29: Remove MUI from ThemeProvider (final cleanup)

**Files:**
- Modify: `src/theme/ThemeProvider.tsx`
- Modify: `src/theme/colorUtils.ts`

- [ ] **Step 1: Remove MUI wrapper from ThemeProvider**

Rewrite `ThemeProvider.tsx` to remove the `MuiThemeProvider`, `CssBaseline`, and `createTheme` imports. Keep only the CSS variable injection:

```typescript
import { useEffect, useMemo, createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeSettings } from './useThemeSettings'
import type { ThemeSettings } from './useThemeSettings'
import { generateCssVariables, getFontStack } from './colorUtils'

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

  const cssVars = useMemo(() => generateCssVariables(seedColor, mode), [seedColor, mode])

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
      {children}
    </ThemeSettingsContext.Provider>
  )
}
```

- [ ] **Step 2: Remove `generateMuiPalette` and `MuiPalette` from `colorUtils.ts`**

Delete the migration-only code (the `MuiPalette` interface and `generateMuiPalette` function).

- [ ] **Step 3: Commit**

```bash
git add src/theme/ThemeProvider.tsx src/theme/colorUtils.ts
git commit -m "refactor: ThemeProvider 移除 MUI wrapper，完成純 CSS 變數架構"
```

---

### Task 30: Remove MUI packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify no MUI imports remain**

Run: `grep -r "@mui" src/` — should return empty.

- [ ] **Step 2: Uninstall MUI packages**

```bash
npm uninstall @mui/material @mui/icons-material
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 移除 @mui/material 和 @mui/icons-material 依賴"
```

---

### Task 31: Visual QA + Final Push

- [ ] **Step 1: Run dev server and manually verify all pages**

```bash
npm run dev
```

Check each route: `/`, `/home`, `/members`, `/events`, `/profile`, `/todos`, `/announcements`, `/games`, `/feedback`, `/admin`, `/admin/roles`, `/admin/users`, `/admin/tickets`, `/admin/feedback`, `/admin/settings`

- [ ] **Step 2: Verify responsive behavior**

- Desktop (>1025px): NavRail visible, content area full width
- Tablet (769-1024px): NavRail narrower, 2-column grids
- Mobile (<=768px): BottomNav visible, single column, no NavRail

- [ ] **Step 3: Verify theme toggle (dark/light)**
- [ ] **Step 4: Verify language switching (font changes)**
- [ ] **Step 5: Verify seed color picker (CSS variables update)**

- [ ] **Step 6: Push to GitHub**

```bash
git push origin main
```
