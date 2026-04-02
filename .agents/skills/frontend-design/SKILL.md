---
name: frontend-design
description: Frontend design standards for SusLab Web — MUI v6, MD3 Dynamic Color, responsive patterns
autoActivate: true
---

# Frontend Design — SusLab Web

## Typography
- NEVER use Arial, Inter, or generic system fonts
- Headings: serif fonts (match Scandinavian Minimal aesthetic)
- Body: clean sans-serif from Google Fonts
- Match font weight to the aesthetic — light for airy, medium for emphasis

## Color System
- Primary seed: `#7C9070` (sage green)
- Landing accent: `#4A7C59` (deeper sage) with cream gradients
- Use `@material/material-color-utilities` for tonal palette generation
- Dark mode: create depth via gradients, not just inverted colors
- Light mode: contrast via spacing, not color overload
- NEVER use rainbow palettes — stick to 1 primary + 1 accent + neutrals

## MUI v6 / MD3 Patterns
- Use `sx` prop for one-off styles, `styled()` for reusable components
- Leverage MD3 color roles: `primary`, `secondary`, `tertiary`, `surface`, `error`
- Dynamic Color: all components inherit from ThemeProvider seed color
- Import from `@mui/material` (NOT `@mui/core`)

## Layout & Responsive
- NavRail (72px) on desktop, BottomNav on mobile — MD3 standard
- All pages must be elastic: use `flex`, `Grid`, percentage widths
- Breakpoints: `xs` (mobile), `sm` (tablet), `md+` (desktop)
- Cards: use `flex-wrap` for badge/chip layouts

## Animation
- Subtle, fast transitions: 200-300ms max
- Loading states: skeleton screens, NEVER spinners
- Use MUI `Fade`, `Grow`, `Slide` transitions
- Hover effects: gentle elevation change or color shift

## i18n
- All user-facing text via `t()` from react-i18next
- Flat key format: `nav.home`, `home.stats.messages`
- Support: en, ja, zh-CN, zh-TW
