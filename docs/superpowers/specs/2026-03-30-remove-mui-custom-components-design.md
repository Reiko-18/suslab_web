# Remove MUI & Build Custom Component Library

**Date:** 2026-03-30
**Status:** Approved

## Overview

Remove all MUI (`@mui/material`, `@mui/icons-material`) dependencies from SusLab Web. Rebuild every UI component from scratch using Emotion CSS-in-JS + CSS Custom Properties. Apply Google Noto fonts per language, use Google Material Symbols for icons, and align visual design to the Figma spec at `figma.com/design/itWFbUb7qUcDbzhH0ugku2`.

## Font System

| Language | Font Family | Weights |
|----------|-------------|---------|
| English  | Noto Sans   | 400, 500, 700 |
| Japanese | Noto Sans JP | 400, 500, 700 |
| Simplified Chinese | Noto Sans SC | 400, 500, 700 |
| Traditional Chinese | Noto Sans TC | 400, 500, 700 |

**Loading:** Google Fonts CDN via `<link>` in `index.html`.

**Language-aware font stack:** CSS variable `--font-primary` dynamically reorders font-family based on current `i18next` language:
- `en` → `'Noto Sans', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans SC', sans-serif`
- `zh-TW` → `'Noto Sans TC', 'Noto Sans', sans-serif`
- `zh-CN` → `'Noto Sans SC', 'Noto Sans', sans-serif`
- `ja` → `'Noto Sans JP', 'Noto Sans', sans-serif`

Triggered by `i18next.on('languageChanged')` → updates `<html lang>` + CSS variable.

**Icons:** Google Material Symbols (Outlined) via CDN. Wrapped in `<Icon name="xxx" size={24} />` component.

## Theme System

### Architecture
- `ThemeProvider` remains a React Context (no MUI dependency)
- `@material/material-color-utilities` generates palettes from seed color
- Palette values injected as CSS Custom Properties on `document.documentElement`
- Components read `var(--color-xxx)` — no JS theme object needed

### CSS Variables

```css
/* Surfaces */
--color-surface:            #2f3136;
--color-surface-dim:        #202225;
--color-surface-container:  #36393f;
--color-surface-bright:     #4f545c;

/* Text */
--color-on-surface:         #dcddde;
--color-on-surface-muted:   #b9bbbe;
--color-on-surface-dim:     #72767d;

/* Primary */
--color-primary:            #5865f2;
--color-on-primary:         #ffffff;

/* Status */
--color-success:            #3ba55c;
--color-error:              #ed4245;
--color-warning:            #faa61a;

/* Radius */
--radius-xs:   2px;
--radius-sm:   5px;
--radius-md:   10px;
--radius-lg:   20px;
--radius-full: 100px;

/* Spacing (4px base) */
--spacing-1:  4px;
--spacing-2:  8px;
--spacing-3:  12px;
--spacing-4:  16px;
--spacing-5:  20px;
--spacing-6:  24px;
--spacing-8:  32px;
--spacing-10: 40px;
--spacing-12: 48px;
--spacing-16: 64px;

/* Transitions */
--transition-fast:   150ms ease;
--transition-normal: 250ms ease;
--transition-slow:   350ms ease;

/* Z-index scale */
--z-dropdown:  100;
--z-sticky:    200;
--z-overlay:   300;
--z-dialog:    400;
--z-snackbar:  500;

/* Font (dynamic per language) */
--font-primary: 'Noto Sans', sans-serif;
```

### Dynamic Color Flow
1. User selects seed color → `themeFromSourceColor()` generates palette
2. Extract `scheme.dark` / `scheme.light` values
3. Map to CSS variables, write to `:root`
4. All components auto-respond (no re-render needed)

### Dark/Light
- Default: dark mode (matches Figma)
- Toggle swaps entire CSS variable set
- Persisted: `localStorage` keys `suslab-theme-mode`, `suslab-theme-seed`

### CSS Reset
Replace MUI `CssBaseline` with a custom CSS reset in `src/styles/reset.css`:
- Normalize box-sizing (`border-box` globally)
- Reset margins/padding on body, headings, lists
- Set `font-family: var(--font-primary)` and `color: var(--color-on-surface)` on body
- Set `background: var(--color-surface-dim)` on body
- Smooth font rendering (`-webkit-font-smoothing: antialiased`)

### `useBreakpoint()` Hook
Replaces MUI's `useMediaQuery()`. API:
```typescript
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
function useBreakpoint(): Breakpoint;
// Uses window.matchMedia internally
// mobile: <=768px, tablet: 769-1024px, desktop: >=1025px
// Also exports: useIsMobile(), useIsDesktop() convenience hooks
```

## Component Library

### Directory Structure

```
src/components/
├── ui/                      # Atomic UI components
│   ├── Icon.tsx
│   ├── Button.tsx           # primary/secondary/ghost/icon/fab variants
│   ├── Card.tsx
│   ├── Dialog.tsx           # Portal + backdrop + focus trap
│   ├── TextField.tsx
│   ├── Select.tsx
│   ├── Chip.tsx
│   ├── Avatar.tsx           # + status indicator
│   ├── Tabs.tsx
│   ├── Table.tsx
│   ├── Skeleton.tsx
│   ├── Snackbar.tsx
│   ├── Switch.tsx
│   ├── Checkbox.tsx
│   ├── LinearProgress.tsx
│   ├── CircularProgress.tsx
│   ├── Tooltip.tsx
│   ├── Menu.tsx
│   ├── Alert.tsx
│   └── Divider.tsx
│
├── layout/                  # Layout primitives
│   ├── Container.tsx        # max-width + auto margin
│   ├── Stack.tsx            # flex direction + gap
│   ├── Grid.tsx             # CSS Grid responsive
│   └── Box.tsx              # div + spacing/flex props
│
├── NavRail.tsx
├── NavDrawer.tsx
├── TopAppBar.tsx
├── BottomNav.tsx            # Replaces MUI BottomNavigation from AppLayout
├── ProtectedRoute.tsx
├── LanguageSelector.tsx
├── ThemeColorPicker.tsx
├── ProfileEditor.tsx
├── MemberCard.tsx
├── MemberDialog.tsx
├── AnnouncementCard.tsx
├── AnnouncementDialog.tsx
├── FeedbackCard.tsx
├── FeedbackDialog.tsx
├── GameBoard2048.tsx
├── GameInviteCard.tsx
├── GameInviteDialog.tsx
├── LeaderboardDialog.tsx
├── LevelCard.tsx
├── TodoItem.tsx
├── ErrorBoundary.tsx
└── admin/
    ├── AuditLogTable.tsx
    ├── RoleDialog.tsx
    ├── TicketCreateDialog.tsx
    ├── TicketDetailDialog.tsx
    └── UserActionDialog.tsx
```

### Design Principles
- Self-contained: each `ui/` component uses Emotion `styled` or `css` prop
- Props API mirrors existing usage where possible (minimize page-level changes)
- All interactive components handle keyboard navigation + ARIA attributes
- Colors via `var(--color-xxx)`, no color props (except Chip custom colors)

### Portal & Focus Trap Strategy
- **Portal**: Use `ReactDOM.createPortal(children, document.body)` for Dialog, Menu, Tooltip, Snackbar
- **Z-index stacking**: Tooltip(100) < Menu(100) < Dialog backdrop(400) < Snackbar(500)
- **Focus trap** (Dialog only):
  - On open: query all focusable elements inside dialog, focus the first one
  - Tab/Shift+Tab cycles within dialog (wrap around at boundaries)
  - Escape key closes dialog
  - On close: restore focus to the element that triggered the dialog
  - Implementation: custom `useFocusTrap(ref)` hook (~40 lines, no external dependency)
- **Backdrop**: Semi-transparent overlay (`rgba(0,0,0,0.5)`), click-to-close (configurable)

### Icon Component Type System
Replace MUI's `SvgIconComponent` type used in `Landing.tsx`, `AppLayout.tsx`, `admin/Overview.tsx`:
```typescript
// Icon name is a string matching Material Symbols names
type IconName = string;

// For components that accept an icon prop:
interface WithIcon {
  icon: IconName;  // e.g., "home", "group", "event"
}

// For brand icons (GitHub, YouTube, X) that need custom SVG:
// Use <Icon name="github" /> which renders from a built-in SVG map
```

### sx Prop Migration Guide
MUI `sx` prop (379 occurrences) → Emotion `css` prop or `styled`:

**Simple spacing:**
```tsx
// Before: <Box sx={{ mt: 2, px: 3 }}>
// After:  <div css={{ marginTop: 'var(--spacing-4)', paddingInline: 'var(--spacing-6)' }}>
```

**Responsive values:**
```tsx
// Before: <Box sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
// After:  <div css={{ flexDirection: 'column', '@media (min-width: 769px)': { flexDirection: 'row' } }}>
```

**Theme references:**
```tsx
// Before: <Box sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
// After:  <div css={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
```

**Conditional styles:**
```tsx
// Before: <Box sx={{ opacity: disabled ? 0.5 : 1 }}>
// After:  <div css={{ opacity: disabled ? 0.5 : 1 }}>  (same pattern, just use css prop)
```

### State Patterns
- **Loading**: Skeleton components with CSS pulse animation (`--transition-slow`)
- **Error**: Alert component with retry button, `var(--color-error)` accent
- **Empty**: Centered icon + message text, `var(--color-on-surface-dim)` color

### Figma-Aligned Specs

| Component | Spec |
|-----------|------|
| Button | `#5865f2` bg, r=`--radius-xs`(2px), font 9.5/600, padding 18x8 |
| Card | `#2f3136` bg, r=10~20, padding 10~20 |
| Sidebar NavItem | 28x28 icon + 10px text, selected = `#eceff8` circle bg |
| Avatar | circle 50~60px, status dot 10px green `#3ba55c` |
| Carousel | r=20, overlay gradient, 14px dot indicators |

## Page Design

### Home (Figma-backed)
- Strict Figma implementation
- Sidebar (94px) + Content Area (flex)
- Carousel (r=20, image overlay + title + desc + Join button)
- Recent Events list (r=10 cards, paginator)

### Other Pages (Figma-consistent, self-designed)

| Page | Layout |
|------|--------|
| Members | Responsive grid card wall, search bar top, Avatar + name + role Chip |
| Events | Card list (Recent Events style), expandable details, register button |
| Profile | Left: large Avatar + info; Right: edit form; Bottom: comments |
| Announcements | Timeline list, pinned card highlight, FAB add button |
| Todos | Tabs (My/All), list + checkbox, inline add form |
| Games | Tabs (2048/Invites/Leaderboard), game board preserves logic |
| Feedback | Card list + vote buttons, filter Chip row |
| Landing | Full-width hero + feature blocks + CTA, dark theme |
| Admin pages | Table-primary, `#2f3136` alternating rows, action buttons right-aligned |

### Shared Layout Rules
- Content max-width: `1156px` (matches Figma content area)
- Page padding: `20px`
- Card gap: `10~16px`
- All lists support Skeleton loading states

### Responsive Breakpoints
- `<=768px`: mobile (BottomNav, single column)
- `769~1024px`: tablet (narrow sidebar, 2 columns)
- `>=1025px`: desktop (full sidebar, Figma layout)

## Package Changes

**Remove:**
- `@mui/material`
- `@mui/icons-material`

**Keep:**
- `@emotion/react`
- `@emotion/styled`
- `@material/material-color-utilities`

**Add (CDN only, no npm):**
- Google Fonts: Noto Sans / TC / SC / JP (400, 500, 700)
- Google Material Symbols Outlined

## MUI → Custom Replacement Map

| MUI | Custom | Notes |
|-----|--------|-------|
| `<Box>` | `<Box>` | div + spacing/flex props |
| `<Stack>` | `<Stack>` | flex direction + gap |
| `<Container>` | `<Container>` | max-width + auto margin |
| `<Grid>` | `<Grid>` | CSS Grid + responsive columns |
| `<Typography>` | Native HTML | `<h1>`~`<h6>`, `<p>`, `<span>` + CSS vars |
| `<Button>` / `<IconButton>` / `<Fab>` | `<Button>` | variant: primary/secondary/ghost/icon/fab |
| `<Card>` / `<CardContent>` / `<CardActions>` | `<Card>` | single component with children |
| `<Dialog>` / `<DialogTitle>` etc. | `<Dialog>` | Portal + backdrop + focus trap |
| `<TextField>` | `<TextField>` | input + label + error state |
| `<Select>` / `<MenuItem>` | `<Select>` | custom dropdown + keyboard nav |
| `<Chip>` | `<Chip>` | inline-flex tag |
| `<Avatar>` / `<AvatarGroup>` | `<Avatar>` | circle img + fallback + status |
| `<Table>` etc. | `<Table>` | native table + styled |
| `<Tabs>` / `<Tab>` | `<Tabs>` | underline-style tabs |
| `<Skeleton>` | `<Skeleton>` | CSS pulse animation |
| `<Snackbar>` / `<Alert>` | `<Snackbar>` + `<Alert>` | fixed toast + message bar |
| `<CircularProgress>` | `<CircularProgress>` | SVG spinner |
| `<LinearProgress>` | `<LinearProgress>` | div width animation |
| `<Tooltip>` | `<Tooltip>` | absolute position + hover |
| `<Menu>` | `<Menu>` | Portal dropdown + keyboard |
| `<Switch>` | `<Switch>` | checkbox disguise |
| `<Checkbox>` | `<Checkbox>` | native + styled |
| `<Divider>` | `<Divider>` | styled `<hr>` |
| `<AppBar>` / `<Toolbar>` | `<TopAppBar>` | fixed header |
| `<Drawer>` | `<NavDrawer>` | slide panel |
| `<BottomNavigation>` | `<BottomNav>` | fixed bottom 5 buttons |
| `sx` prop | `css` prop / `styled` | Emotion native API |
| `useTheme()` | CSS variables | no JS theme read needed |
| `useMediaQuery()` | `useBreakpoint()` | custom hook with `matchMedia` |

## Icon Replacement (Complete — 57 icons)

| MUI Icon | Material Symbol | Notes |
|----------|----------------|-------|
| AccessTimeIcon | `schedule` | |
| AddIcon | `add` | |
| BlockIcon | `block` | |
| BrushIcon | `brush` | |
| CalendarMonthIcon | `calendar_month` | |
| CampaignIcon | `campaign` | |
| CheckCircleIcon | `check_circle` | |
| CheckIcon | `check` | |
| ChecklistIcon | `checklist` | |
| ChevronLeftIcon | `chevron_left` | |
| ChevronRightIcon | `chevron_right` | |
| ConfirmationNumberIcon | `confirmation_number` | |
| DarkModeIcon | `dark_mode` | |
| DashboardIcon | `dashboard` | |
| DeleteIcon | `delete` | |
| EditIcon | `edit` | |
| EmailIcon | `email` | |
| EmojiEventsIcon | `emoji_events` | |
| EventIcon | `event` | |
| ExpandLessIcon | `expand_less` | |
| ExpandMoreIcon | `expand_more` | |
| FavoriteIcon | `favorite` | |
| FeedbackIcon | `feedback` | |
| GridViewIcon | `grid_view` | |
| HomeIcon | `home` | |
| LeaderboardIcon | `leaderboard` | |
| LightModeIcon | `light_mode` | |
| LinkIcon | `link` | |
| LocationOnIcon | `location_on` | |
| LoginIcon | `login` | |
| LogoutIcon | `logout` | |
| ManageAccountsIcon | `manage_accounts` | |
| MenuIcon | `menu` | |
| MilitaryTechIcon | `military_tech` | |
| PaletteIcon | `palette` | |
| PeopleIcon | `group` | |
| PersonIcon | `person` | |
| PushPinIcon | `push_pin` | |
| RateReviewIcon | `rate_review` | |
| SaveIcon | `save` | |
| SearchIcon | `search` | |
| SettingsIcon | `settings` | |
| ShieldIcon | `shield` | |
| SmartToyIcon | `smart_toy` | |
| SportsEsportsIcon | `sports_esports` | |
| SyncIcon | `sync` | |
| ThumbUpIcon | `thumb_up` | |
| ThumbUpOutlinedIcon | `thumb_up` | Use `outlined` variant (default) |
| TimerIcon | `timer` | |
| TranslateIcon | `translate` | |
| VerifiedIcon | `verified` | |
| ViewListIcon | `view_list` | |
| GitHubIcon | Custom SVG | No brand icons in Material Symbols |
| YouTubeIcon | Custom SVG | No brand icons in Material Symbols |
| XIcon | Custom SVG | No brand icons in Material Symbols |

**Brand SVG icons** (GitHub, YouTube, X) will be embedded as simple `<svg>` elements inside the `Icon` component's internal SVG map, rendered when `name` matches a brand key.

## Theme Migration Details

### Files requiring MUI removal in `src/theme/`:
- **`ThemeProvider.tsx`**: Remove MUI `ThemeProvider` and `CssBaseline` wrapper. Replace with custom React Context that manages CSS variables on `:root`. Keep Material Color Utilities palette generation logic.
- **`useThemeSettings.ts`**: Remove MUI `useTheme()` import. Read theme values from custom context or CSS variables instead.
- **`colorUtils.ts`**: No changes needed (already pure utility, no MUI dependency).

### `main.jsx` changes:
- Remove MUI `<ThemeProvider>` wrapping
- Replace with custom `<ThemeProvider>` that sets CSS variables
- Remove `<CssBaseline />` — replaced by `reset.css` import
