# Sub-project 1: Infrastructure + UI Rebuild Design

## Overview

Rebuild the SusLab web platform from custom CSS to MUI (Material UI) v6 with MD3-inspired Dynamic Color theming, i18n (4 languages), and a new Navigation Rail + Drawer layout. This sub-project establishes the foundation for subsequent feature development.

**MUI version note:** MUI v6 (`@mui/material@6`) is the latest stable release. It follows Material Design 2 with extensive theming capabilities. MD3 Dynamic Color is achieved by using `@material/material-color-utilities` to generate tonal palettes and mapping them to MUI's `createTheme()` palette structure. This is a custom bridge — MUI does not natively implement MD3.

## Project Context

SUS LAB is a multi-discipline creative community Discord server spanning gaming, music production, digital art, video editing, and programming. The web platform extends Discord's capabilities with member management, events, minigames, and admin tools.

### Full Project Decomposition

| Sub-project | Scope | Depends On |
|-------------|-------|------------|
| **1: Infrastructure + UI Rebuild** (this spec) | MUI v6, i18n, theme system, layout, landing page, functional pages + stub pages | None |
| **2: User Interface** | Welcome dashboard, members, profile enhancements, to-do, announcements, games, feedback | Sub-project 1 |
| **3: Admin Dashboard** | Role management, user management, tickets, feedback review, system settings | Sub-project 1 + 2 |
| **4: Discord Bot** | Bot commands mirroring all web features | Sub-project 2 + 3 |

Each sub-project follows its own spec → plan → implementation cycle.

## Current State

- Vite + React 19 SPA with react-router-dom v7
- Custom CSS with CSS variables (nature-themed green palette)
- Discord OAuth via Supabase Auth
- Role-based access control (admin/moderator/member) with RLS + Edge Functions
- Pages: Home, Dashboard (events), Profile, Admin (user roles), AuthCallback
- Components: Navbar, Button, ProtectedRoute
- Icons: lucide-react

## Goals

- Replace all custom CSS with MUI components and `sx` prop
- MD3-inspired Dynamic Color theming via `@material/material-color-utilities` mapped to MUI's theme
- Light/dark mode (default light, toggle available)
- i18n with 4 languages: en (default fallback), ja, zh-CN, zh-TW
- Navigation Rail (collapsed 72px) + Persistent Drawer (expanded 240px) layout
- Preserve existing functional pages (Events, Profile, Admin Users) restyled in MUI
- New pages added as stubs for Sub-project 2 and 3
- Preserve all existing auth, RLS, and Edge Functions — no backend changes

---

## 1. New Dependencies

### Add

| Package | Version | Purpose |
|---------|---------|---------|
| `@mui/material` | `^6` | Material UI component library (latest stable) |
| `@mui/icons-material` | `^6` | Material icons |
| `@emotion/react` | `^11` | CSS-in-JS engine (MUI peer dep) |
| `@emotion/styled` | `^11` | Styled components (MUI peer dep) |
| `@material/material-color-utilities` | `^0.3` | MD3 Dynamic Color palette generation from seed color |
| `react-i18next` | `^15` | React i18n integration |
| `i18next` | `^24` | Core i18n framework |
| `i18next-browser-languagedetector` | `^8` | Auto-detect browser language |

### Remove

| Package | Reason |
|---------|--------|
| `lucide-react` | Replaced by `@mui/icons-material` |

### Preserve

- `@supabase/supabase-js` — backend
- `react-router-dom` — routing
- `axios` — HTTP client (useFetch hook)
- `vite` + `@vitejs/plugin-react` — build tool

---

## 2. Theme System

### Directory: `src/theme/`

| File | Responsibility |
|------|---------------|
| `ThemeProvider.jsx` | Wraps MUI `ThemeProvider` + `CssBaseline`. Manages light/dark mode toggle and Dynamic Color. Reads/writes preferences via `useThemeSettings`. |
| `colorUtils.js` | Uses `@material/material-color-utilities` to generate a full MD3-style tonal palette from a seed color. Exports `generateMuiPalette(seedColor)` that maps MD3 roles to MUI palette. |
| `useThemeSettings.js` | Custom hook. Reads/writes to localStorage. Returns `{ mode, seedColor, setMode, setSeedColor }`. |

### Dynamic Color Flow

1. User picks a seed color (default `#6750A4` — MD3 default purple)
2. `@material/material-color-utilities` `themeFromSourceColor()` generates tonal palettes
3. Extract MD3 color roles and map to MUI `createTheme()` palette:

```
MD3 Role              → MUI Palette Key
─────────────────────────────────────────
primary               → palette.primary.main
onPrimary             → palette.primary.contrastText
primaryContainer      → palette.primary.light
onPrimaryContainer    → palette.primary.dark
secondary             → palette.secondary.main
onSecondary           → palette.secondary.contrastText
secondaryContainer    → palette.secondary.light
onSecondaryContainer  → palette.secondary.dark
tertiary              → palette.info.main (repurpose)
error                 → palette.error.main
surface               → palette.background.default
onSurface             → palette.text.primary
surfaceVariant        → palette.background.paper
onSurfaceVariant      → palette.text.secondary
outline               → palette.divider
```

4. Separate light and dark schemes are derived from the same seed
5. Theme updates reactively when seed color or mode changes

### localStorage Keys

```json
{
  "suslab-theme-mode": "light",
  "suslab-theme-seed": "#6750A4"
}
```

### Typography

- Primary: `Roboto` (weights: 400, 500, 700)
- CJK fallback: `Noto Sans TC` (400, 700), `Noto Sans SC` (400, 700), `Noto Sans JP` (400, 700)
- Font stack: `'Roboto', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans JP', system-ui, sans-serif`
- Google Fonts URL uses `&display=swap` for performance
- CJK fonts loaded with `text` parameter or as separate `<link>` tags to allow browser to skip unused fonts

---

## 3. i18n Architecture

### Directory: `src/i18n/`

| File | Responsibility |
|------|---------------|
| `index.js` | Initialize i18next with `react-i18next` and `i18next-browser-languagedetector`. Single `translation` namespace. Updates `document.documentElement.lang` on language change. |
| `locales/en.json` | English translations (default fallback) |
| `locales/ja.json` | Japanese translations |
| `locales/zh-CN.json` | Simplified Chinese translations |
| `locales/zh-TW.json` | Traditional Chinese translations |

### Configuration

- **Detection order:** localStorage → browser navigator language → fallback `en`
- **localStorage key:** `suslab-language`
- **Namespace:** Single `translation` namespace
- **Interpolation:** `{{variable}}` syntax
- **`index.html`:** Change `lang="zh-TW"` to `lang="en"` as default. i18n init will dynamically update `document.documentElement.lang` to match detected/selected language.

### Translation Key Structure

Flat keys with dot-separated hierarchy:

```json
{
  "nav.home": "Home",
  "nav.members": "Members",
  "nav.profile": "Profile",
  "nav.events": "Events",
  "nav.todos": "To-Do",
  "nav.announcements": "Announcements",
  "nav.games": "Games",
  "nav.feedback": "Feedback",
  "nav.admin.roles": "Roles",
  "nav.admin.users": "Users",
  "nav.admin.tickets": "Tickets",
  "nav.admin.feedbackReview": "Feedback Review",
  "nav.admin.settings": "Settings",
  "nav.admin.label": "Admin",
  "nav.login": "Sign in with Discord",
  "theme.light": "Light Mode",
  "theme.dark": "Dark Mode",
  "theme.color": "Theme Color",
  "language.en": "English",
  "language.ja": "日本語",
  "language.zhCN": "简体中文",
  "language.zhTW": "繁體中文",
  "common.loading": "Loading...",
  "common.error": "An error occurred",
  "common.noPermission": "Permission Denied",
  "common.noPermissionDesc": "You need {{role}} permission to access this page.",
  "common.comingSoon": "Coming soon",
  "landing.hero.title": "SUS LAB",
  "landing.hero.subtitle": "A creative community for gamers, musicians, artists, editors & developers",
  "landing.hero.cta": "Join with Discord",
  "landing.features.title": "What we offer",
  "landing.features.members.title": "Member System",
  "landing.features.members.desc": "Connect with fellow creators and explore member profiles",
  "landing.features.events.title": "Events & Activities",
  "landing.features.events.desc": "Join community events, workshops, and collaborations",
  "landing.features.games.title": "Minigames",
  "landing.features.games.desc": "Play fun games with community members",
  "landing.features.achievements.title": "Achievements",
  "landing.features.achievements.desc": "Earn badges and level up as you participate",
  "landing.features.feedback.title": "Community Voice",
  "landing.features.feedback.desc": "Share ideas and help shape the community",
  "landing.features.announcements.title": "Announcements",
  "landing.features.announcements.desc": "Stay updated with the latest community news",
  "landing.stats.members": "Members",
  "landing.stats.events": "Events",
  "landing.stats.partners": "Partners",
  "landing.cta.title": "Ready to join?",
  "landing.cta.desc": "Sign in with Discord to become part of the community",
  "landing.footer.copyright": "© {{year}} SUS LAB. All rights reserved.",
  "profile.role": "Role",
  "profile.joinDate": "Joined",
  "profile.verifiedVia": "Verified via Discord",
  "profile.logout": "Sign Out",
  "admin.users.title": "User Management",
  "admin.users.name": "User",
  "admin.users.email": "Email",
  "admin.users.currentRole": "Current Role",
  "admin.users.changeRole": "Change Role",
  "admin.users.self": "(You)",
  "admin.users.roleUpdated": "Role updated. The user must re-login for it to take effect.",
  "admin.users.roleUpdateFailed": "Failed to update role",
  "events.title": "Events",
  "events.subtitle": "Community events and activities",
  "events.empty": "No events yet",
  "events.attendees": "{{count}} attending"
}
```

### Language Selector UI

MUI `Select` or `IconButton` + `Menu` showing language names in their native script:
- English
- 日本語
- 简体中文
- 繁體中文

---

## 4. App Layout

### Navigation Pattern: Rail + Drawer Hybrid

**Desktop:**
- **Collapsed (default):** 72px Navigation Rail with icons only. MUI `Tooltip` on hover shows label.
- **Expanded (on click):** 240px Persistent Drawer with full text labels
- User section and Admin section separated by a MUI `Divider`
- Admin section only visible to users with `moderator` or `admin` role (uses `hasRole('moderator')`)

**Mobile (≤768px):**
- Rail collapses to MUI `BottomNavigation` with 5 items: Home, Members, Events, Games, Profile
- Full navigation available via hamburger menu → overlay MUI `Drawer`

**Top App Bar:**
- Left: Menu/expand toggle button + current page title (i18n)
- Right: Language selector, theme toggle (light/dark icon button), theme color picker, user avatar + dropdown menu

### Authenticated redirect on `/`

If an authenticated user navigates to `/` (landing page), automatically redirect to `/home` (welcome dashboard). This prevents logged-in users from seeing the landing page.

### Layout Components

| File | Responsibility |
|------|---------------|
| `src/layouts/AppLayout.jsx` | Main authenticated layout. Renders NavRail/NavDrawer + TopAppBar + `<Outlet>` content area. Manages drawer open/close state. |
| `src/layouts/PublicLayout.jsx` | Simple layout for landing page. No sidebar — just a minimal top bar + content + footer. |

### Navigation Components

| File | Responsibility |
|------|---------------|
| `src/components/NavRail.jsx` | 72px collapsed rail. SusLab logo + icon buttons + divider + admin icons. MUI `Tooltip` on hover. |
| `src/components/NavDrawer.jsx` | 240px expanded drawer. Logo + text labels + admin section header + user card at bottom. MUI `Drawer` with `variant="persistent"`. |
| `src/components/TopAppBar.jsx` | MUI `AppBar`. Left: drawer toggle + page title. Right: `LanguageSelector` + theme toggle + `ThemeColorPicker` + user `Avatar` with dropdown menu. |
| `src/components/ThemeColorPicker.jsx` | MUI `Popover` with color swatches or color input. Calls `useThemeSettings().setSeedColor()`. |
| `src/components/LanguageSelector.jsx` | MUI `IconButton` + `Menu`. Lists 4 languages in native names. Calls `i18n.changeLanguage()` and updates `document.documentElement.lang`. |

---

## 5. Page Structure

### Functional vs Stub Pages

Pages fall into two categories in this sub-project:

- **Functional:** Preserve existing working logic, restyle with MUI + i18n. These pages already have backend integration.
- **Stub:** Placeholder pages with title + "Coming Soon" card. Routing and navigation work, but no feature logic.

### Public Pages (no auth)

| Route | Component | Type | Description |
|-------|-----------|------|-------------|
| `/` | `Landing.jsx` | Functional | Public landing page with hero, features, stats, CTA. Redirects to `/home` if authenticated. |
| `/auth/callback` | `AuthCallback.jsx` | Functional | OAuth callback handler (preserved, restyled with MUI) |

### User Pages (member+)

| Route | Component | Type | Description |
|-------|-----------|------|-------------|
| `/home` | `Home.jsx` | Stub | Welcome dashboard — placeholder cards |
| `/members` | `Members.jsx` | Stub | Member list |
| `/profile` | `Profile.jsx` | Functional | Own profile — preserves existing Discord data display + role display + edge function call, restyled with MUI + i18n |
| `/events` | `Events.jsx` | Functional | Preserves existing event fetching via `edgeFunctions.getEvents()`, restyled with MUI + i18n |
| `/todos` | `Todos.jsx` | Stub | Personal to-do list |
| `/announcements` | `Announcements.jsx` | Stub | Server announcements |
| `/games` | `Games.jsx` | Stub | Minigames, invites |
| `/feedback` | `Feedback.jsx` | Stub | Submit feedback/ideas |

### Admin Pages (moderator+)

Admin pages use `minimumRole="moderator"` in ProtectedRoute, allowing both moderators and admins to access the admin section. Specific actions within pages (e.g., role changes) may further restrict to admin-only at the Edge Function level.

| Route | Component | Type | Description |
|-------|-----------|------|-------------|
| `/admin/roles` | `admin/Roles.jsx` | Stub | Role CRUD + Discord sync |
| `/admin/users` | `admin/Users.jsx` | Functional | Preserves existing user management table + role editing, restyled with MUI + i18n |
| `/admin/tickets` | `admin/Tickets.jsx` | Stub | Ticket system |
| `/admin/feedback` | `admin/FeedbackReview.jsx` | Stub | Feedback review |
| `/admin/settings` | `admin/Settings.jsx` | Stub | System config |

### Stub Page Pattern

Every stub page renders:

```jsx
<Container maxWidth="lg" sx={{ py: 4 }}>
  <Typography variant="h4" gutterBottom>{t('nav.pageName')}</Typography>
  <Card sx={{ p: 4, textAlign: 'center' }}>
    <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
  </Card>
</Container>
```

---

## 6. Landing Page Design

### Content Sections

1. **Hero** — Large `Typography` h2 title ("SUS LAB") + subtitle describing the community + MUI `Button` CTA for Discord login. Background uses Dynamic Color gradient from theme.
2. **Features Grid** — MUI `Grid` of `Card` components showing 6 platform features (members, events, games, achievements, feedback, announcements) with Material Icons. Each card uses i18n keys `landing.features.*.title` and `landing.features.*.desc`.
3. **Community Stats** — Row of stat numbers (members, events, partners) using `Typography` variants.
4. **CTA Section** — Bottom call-to-action with another Discord login button. Uses `Paper` with theme surface variant background.
5. **Footer** — Simple `Box` with copyright using i18n key `landing.footer.copyright` with `{{year}}` interpolation.

All text uses i18n keys. Layout responsive via MUI `Grid` and `Stack`.

---

## 7. Files to Create/Modify/Delete

### New files

- `src/theme/ThemeProvider.jsx`
- `src/theme/colorUtils.js`
- `src/theme/useThemeSettings.js`
- `src/i18n/index.js`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ja.json`
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/zh-TW.json`
- `src/layouts/AppLayout.jsx`
- `src/layouts/PublicLayout.jsx`
- `src/components/NavRail.jsx`
- `src/components/NavDrawer.jsx`
- `src/components/TopAppBar.jsx`
- `src/components/ThemeColorPicker.jsx`
- `src/components/LanguageSelector.jsx`
- `src/pages/Landing.jsx`
- `src/pages/Members.jsx`
- `src/pages/Todos.jsx`
- `src/pages/Announcements.jsx`
- `src/pages/Games.jsx`
- `src/pages/Feedback.jsx`
- `src/pages/admin/Roles.jsx`
- `src/pages/admin/Tickets.jsx`
- `src/pages/admin/FeedbackReview.jsx`
- `src/pages/admin/Settings.jsx`

### Modified files (rewrite with MUI + i18n)

- `src/main.jsx` — wrap with custom ThemeProvider + import i18n init
- `src/App.jsx` — new route definitions using AppLayout/PublicLayout, add authenticated redirect on `/`
- `src/components/ProtectedRoute.jsx` — restyle with MUI, replace hardcoded Chinese with `t('common.noPermission')` and `t('common.noPermissionDesc')`
- `src/pages/Profile.jsx` — preserve edge function call + Discord data display, restyle with MUI + i18n
- `src/pages/Events.jsx` (was Dashboard.jsx) — preserve `edgeFunctions.getEvents()` logic, restyle with MUI + i18n
- `src/pages/admin/Users.jsx` (was Admin.jsx) — preserve user table + role editing logic, restyle with MUI + i18n
- `src/pages/AuthCallback.jsx` — restyle loading spinner with MUI `CircularProgress`
- `index.html` — update Google Fonts (add Roboto, Noto Sans TC/SC/JP with weights 400,500,700 and `display=swap`), change `lang="zh-TW"` to `lang="en"`
- `package.json` — add new dependencies, remove lucide-react

### Deleted files

- `src/index.css` — replaced by MUI CssBaseline
- `src/App.css`
- `src/pages/Dashboard.jsx` — replaced by `Events.jsx`
- `src/pages/Dashboard.css`
- `src/pages/Profile.css`
- `src/pages/Admin.jsx` — replaced by `admin/Users.jsx`
- `src/pages/Admin.css`
- `src/pages/Home.jsx` — replaced by new `Home.jsx` (stub) + `Landing.jsx`
- `src/components/Navbar.jsx` — replaced by NavRail + NavDrawer + TopAppBar
- `src/components/Navbar.css`
- `src/components/Button.jsx` — replaced by MUI Button

---

## 8. What This Sub-project Does NOT Include

These are deferred to later sub-projects:

- **No new database tables** — existing auth, user_roles, events tables unchanged
- **No new Edge Functions** — existing 4 functions unchanged
- **No new feature logic** — stub pages are placeholders only
- **No Discord bot** — separate sub-project
- **No new Supabase configuration** — no RLS or migration changes

### Preserved backend interactions

All existing functional data flows are preserved and restyled:
- Discord OAuth login/logout
- Events fetching via `edgeFunctions.getEvents()` (in `Events.jsx`)
- Profile data via `edgeFunctions.getProfile()` + auth context (in `Profile.jsx`)
- Admin user management via `edgeFunctions.getUsers()` and `edgeFunctions.updateUserRole()` (in `admin/Users.jsx`)
