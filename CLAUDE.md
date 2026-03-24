# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite 8, HMR enabled)
- **Build:** `npm run build` (outputs to `dist/`)
- **Lint:** `npm run lint` (ESLint flat config, `eslint .`)
- **Preview production build:** `npm run preview`
- **Deploy Edge Functions:** `npx supabase functions deploy --no-verify-jwt`

No test runner is configured yet.

## Tech Stack

- **Frontend:** React 19, MUI v6 (Material Design 3), Emotion CSS-in-JS
- **Routing:** react-router-dom v7
- **i18n:** react-i18next (en, ja, zh-CN, zh-TW)
- **Auth:** Supabase Auth (Discord OAuth, implicit flow)
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Theme:** @material/material-color-utilities (Dynamic Color from seed)
- **Build:** Vite 8
- **Deploy:** Render.com (static SPA with rewrite rules)

## Architecture

Vite + React 19 SPA with Supabase backend.

### Frontend (`src/`)

```
src/
├── main.jsx              # Entry: BrowserRouter > ThemeProvider > AuthProvider > App
├── App.jsx               # Route definitions (public, authenticated, admin)
├── layouts/
│   ├── AppLayout.jsx     # Authenticated: NavRail + NavDrawer + TopAppBar + BottomNav
│   └── PublicLayout.jsx  # Public: simple AppBar + Outlet
├── pages/
│   ├── Landing.jsx       # Public landing (nature-inspired design)
│   ├── Home.jsx          # Dashboard (stats, badges, announcements)
│   ├── Members.jsx       # Member directory with search + info cards
│   ├── Profile.jsx       # Own profile + ProfileEditor
│   ├── Events.jsx        # Events with registration + XP/level card
│   ├── Todos.jsx         # Personal + community to-do lists
│   ├── Announcements.jsx # Announcements feed (moderator+ can create)
│   ├── Games.jsx         # 2048 game + game invites
│   ├── Feedback.jsx      # Feature/event/bug feedback with voting
│   ├── AuthCallback.jsx  # OAuth callback handler
│   └── admin/
│       ├── Overview.jsx      # Admin dashboard overview
│       ├── Roles.jsx         # Discord role management (CRUD + sync)
│       ├── Users.jsx         # User management (ban/kick/timeout + role change)
│       ├── Tickets.jsx       # Support ticket queue + replies
│       ├── FeedbackReview.jsx # Moderate user feedback
│       └── Settings.jsx      # System settings (server, notifications)
├── components/
│   ├── NavRail.jsx           # 72px collapsed sidebar (desktop)
│   ├── NavDrawer.jsx         # 240px expanded sidebar
│   ├── TopAppBar.jsx         # App bar (title, theme, language, user menu)
│   ├── ProtectedRoute.jsx    # Auth + role guard
│   ├── LanguageSelector.jsx  # 4-language switcher
│   ├── ThemeColorPicker.jsx  # Seed color picker
│   ├── GameBoard2048.jsx     # Full 2048 game
│   ├── ProfileEditor.jsx     # Bio, skills, social links, visibility
│   ├── MemberCard/Dialog.jsx # Member info cards
│   ├── FeedbackCard/Dialog.jsx
│   ├── AnnouncementCard/Dialog.jsx
│   ├── GameInviteCard/Dialog.jsx
│   ├── TodoItem.jsx
│   ├── LevelCard.jsx
│   ├── LeaderboardDialog.jsx
│   └── admin/                # Admin-specific components
├── theme/
│   ├── ThemeProvider.jsx     # MUI ThemeProvider + CssBaseline + Dynamic Color
│   ├── colorUtils.js         # Seed color → MD3 tonal palette → MUI palette
│   └── useThemeSettings.js   # localStorage hook (mode + seed color)
├── i18n/
│   ├── index.js              # i18next init + browser language detection
│   └── locales/{en,ja,zh-CN,zh-TW}.json
├── services/
│   ├── supabaseClient.js     # Supabase client (implicit flow)
│   └── edgeFunctions.js      # All Edge Function API calls
├── context/
│   └── AuthContext.jsx       # Auth state (user, role, session, hasRole)
├── hooks/
│   └── useFetch.js           # Axios wrapper hook
└── utils/
    └── format.js             # Date/currency formatting (zh-TW locale)
```

### Backend (`supabase/`)

```
supabase/
├── migrations/               # 001-016 SQL migrations (tables, RLS, triggers)
├── functions/
│   ├── _shared/
│   │   ├── auth.ts           # JWT verification + role check helper
│   │   ├── cors.ts           # CORS headers
│   │   └── xp.ts             # Atomic XP addition helper
│   ├── get-events/           # List events (member+)
│   ├── get-members/          # List members with visibility filter (member+)
│   ├── get-profile/          # Get own profile (member+)
│   ├── get-stats/            # Community stats (member+)
│   ├── manage-events/        # CRUD events + register/unregister (member+/moderator+)
│   ├── manage-announcements/ # CRUD announcements (member+/moderator+)
│   ├── manage-feedbacks/     # CRUD + vote + status (member+/moderator+)
│   ├── manage-games/         # Game invites + 2048 scores (member+)
│   ├── manage-levels/        # XP/level/badges (member+)
│   ├── manage-profile/       # Get/update own profile (member+)
│   ├── manage-roles/         # CRUD Discord roles (admin)
│   ├── manage-tickets/       # CRUD tickets + replies (member+/moderator+)
│   ├── manage-todos/         # CRUD todos + claim/unclaim (member+)
│   ├── manage-users/         # User management + role change (admin)
│   ├── profile-comments/     # CRUD profile comments (member+)
│   ├── admin-overview/       # Admin dashboard stats (moderator+)
│   └── admin-settings/       # System settings CRUD (admin)
└── SETUP_ALL.sql             # Combined idempotent SQL for fresh setup
```

### Database Tables (Supabase PostgreSQL)

| Table | Purpose |
|-------|---------|
| `user_roles` | User roles (admin/moderator/member) + JWT hook |
| `events` | Community events |
| `event_registrations` | Event registration join table |
| `member_profiles` | Bio, skills, social links, visibility settings |
| `profile_comments` | Comments on member profiles |
| `announcements` | Community announcements (web + Discord source) |
| `todos` | Personal + community to-do items |
| `game_invites` | Game invitation lobby |
| `game_invite_participants` | Game invite participants |
| `game_scores` | 2048 leaderboard scores |
| `feedbacks` | Feature/event/bug feedback |
| `feedback_votes` | Feedback upvotes |
| `user_levels` | XP, level, badges per user |
| `discord_roles` | Discord role sync config |
| `admin_audit_logs` | All admin action audit trail |
| `pending_bot_actions` | Queue for Discord bot actions |
| `tickets` | Support tickets |
| `ticket_replies` | Ticket reply thread |
| `system_settings` | KV store for system config |

### Auth Flow

1. User clicks "Join with Discord" → `signInWithOAuth` (implicit flow)
2. Supabase redirects to Discord → authorize → redirect back with `#access_token`
3. Supabase client auto-detects hash → establishes session
4. `AuthContext.onAuthStateChange` fires → sets user/role/session
5. `custom_access_token_hook` injects role from `user_roles` into JWT
6. Role also synced to `auth.users.raw_app_meta_data` for implicit flow compatibility

### Role System

- **member** — default, can access all user pages
- **moderator** — can manage events, announcements, tickets, feedback status
- **admin** — full access, can manage users/roles/settings

`hasRole(minimumRole)` checks `ROLE_LEVELS` hierarchy. Admin routes wrapped in `<ProtectedRoute minimumRole="moderator">`.

## Key Conventions

- Environment variables must be prefixed with `VITE_` to be exposed to client code
- ESLint rule: `no-unused-vars` ignores variables starting with uppercase or underscore
- `.env` is gitignored — never commit secrets
- All Edge Functions use `_shared/auth.ts` for JWT verification
- All Edge Functions use `service_role` key for database access (bypasses RLS for admin ops)
- RLS policies provide second layer of defense on all tables
- Theme seed color stored in `localStorage` key `suslab-theme-seed`
- Language stored in `localStorage` key `suslab-language`

## Design Principles

- **Landing page:** Nature-inspired, warm earth tones (sage green `#4A7C59`, cream gradients)
- **Dashboard:** Scandinavian Minimal — serif headings, airy spacing, soft shadows
- **Default seed color:** `#7C9070` (sage green)
- **Navigation:** NavRail (72px, desktop) + NavDrawer (240px, expand) + BottomNav (mobile)
- **Responsive:** All pages must be elastic — adapt to any screen size
- **i18n:** All user-facing text via `t()`, flat key format (`nav.home`, `home.stats.messages`)

## Rules

ALWAYS before making any change, search on the web for the newest documentation.
And only implement if you are 100% sure it will work.
Before making any changes, always look up the latest documentation using 3 sub agents.
Codex will review your works.
After every change, auto commit and push to GitHub.

## Mindset

You are an enterprise grade engineer. You are paid millions. You don't make mistakes.
