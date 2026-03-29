# CLAUDE.md — SusLab Web

## WHAT — Tech Stack & Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, MUI v6 (MD3), Emotion CSS-in-JS |
| Routing | react-router-dom v7 |
| i18n | react-i18next (en, ja, zh-CN, zh-TW) |
| Auth | Supabase Auth (Discord OAuth, implicit flow) |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Theme | @material/material-color-utilities (Dynamic Color) |
| Build | Vite 8 |
| Deploy | Render.com (static SPA with rewrite rules) |

### Directory Map

```
src/
├── main.jsx           # Entry: BrowserRouter > ThemeProvider > AuthProvider > App
├── App.jsx            # Route definitions (public, authenticated, admin)
├── layouts/           # AppLayout (authenticated) + PublicLayout
├── pages/             # Landing, Home, Members, Profile, Events, Todos,
│   │                  # Announcements, Games, Feedback, AuthCallback
│   └── admin/         # Overview, Roles, Users, Tickets, FeedbackReview, Settings
├── components/        # NavRail, NavDrawer, TopAppBar, ProtectedRoute, GameBoard2048,
│                      # ProfileEditor, MemberCard, FeedbackCard, LevelCard, etc.
├── theme/             # ThemeProvider, colorUtils, useThemeSettings
├── i18n/              # i18next init + locales/{en,ja,zh-CN,zh-TW}.json
├── services/          # supabaseClient.js, edgeFunctions.js
├── context/           # AuthContext.jsx (user, role, session, hasRole)
├── hooks/             # useFetch.js (Axios wrapper)
└── utils/             # format.js (date/currency, zh-TW locale)

supabase/
├── migrations/        # 001-016 SQL migrations
├── functions/         # Edge Functions (get-*, manage-*, admin-*, profile-comments)
│   └── _shared/       # auth.ts, cors.ts, xp.ts
└── SETUP_ALL.sql      # Combined idempotent SQL
```

### Database (19 tables)

`user_roles` | `events` | `event_registrations` | `member_profiles` | `profile_comments` | `announcements` | `todos` | `game_invites` | `game_invite_participants` | `game_scores` | `feedbacks` | `feedback_votes` | `user_levels` | `discord_roles` | `admin_audit_logs` | `pending_bot_actions` | `tickets` | `ticket_replies` | `system_settings`

### Role System

- **member** — default, all user pages
- **moderator** — manage events/announcements/tickets/feedback
- **admin** — full access (users/roles/settings)

`hasRole(minimumRole)` checks hierarchy. Admin routes use `<ProtectedRoute minimumRole="moderator">`.

### Auth Flow

1. Discord OAuth (implicit flow) via `signInWithOAuth`
2. Supabase redirects back with `#access_token`
3. `AuthContext.onAuthStateChange` sets user/role/session
4. `custom_access_token_hook` injects role into JWT
5. Role synced to `raw_app_meta_data` for implicit flow compatibility

## WHY — Design Decisions

- **MUI v6 + MD3 Dynamic Color**: Consistent theming from a single seed color (`#7C9070` sage green)
- **Supabase Edge Functions + service_role**: Bypass RLS for admin ops; RLS is second defense layer
- **Implicit OAuth flow**: Simplest Discord auth; no server-side token exchange needed
- **NavRail pattern**: MD3 standard; 72px collapsed, 240px expanded, BottomNav on mobile
- **Landing**: Nature-inspired, warm earth tones (sage green `#4A7C59`, cream gradients)
- **Dashboard**: Scandinavian Minimal — serif headings, airy spacing, soft shadows
- **i18n flat keys**: `nav.home`, `home.stats.messages` — simple, grep-friendly

## HOW — Commands & Workflows

### Commands

```bash
npm run dev          # Vite 8 dev server (HMR)
npm run build        # Production build → dist/
npm run lint         # ESLint flat config
npm run preview      # Preview production build
npx supabase functions deploy --no-verify-jwt  # Deploy Edge Functions
```

No test runner configured yet.

### Conventions

- Env vars: prefix with `VITE_` for client exposure
- ESLint: `no-unused-vars` ignores uppercase/underscore-prefixed vars
- `.env` is gitignored — never commit secrets
- Edge Functions: always use `_shared/auth.ts` for JWT verification
- Theme seed: `localStorage` key `suslab-theme-seed`
- Language: `localStorage` key `suslab-language`
- All user-facing text via `t()` function

### Gotchas

- SPA on Render.com needs rewrite rules (`/* → /index.html`) or all routes 404
- Discord OAuth callback lands on `/index.html` with hash — `AuthCallback` must handle it
- `service_role` key in Edge Functions bypasses ALL RLS — guard with `_shared/auth.ts`
- MUI v6 uses `@mui/material` not `@mui/core` — import paths changed from v5

## 語言規則

- **語言規格**: 所有回覆一律使用**繁體中文**。包括程式碼註解、commit message 說明部分、Obsidian 筆記內容等，皆以中文為主（技術術語和程式碼本身除外）。

## 工作流程規則

- **commit以及push**: 任務完成後自動 commit 並 push 到 GitHub
- **Obsidian筆記**: 任務完成後自動更新相關 Obsidian 筆記
- **先查詢再實作**: 變更前在網路上查詢最新有關技術文件，確認可行後再實作
- **派出agent進行審查**: 再進行任何變更之前，使用3個agent對變更的內容進行審查(再網路上蒐集最新資訊查證，查找代碼錯誤，再次確認)
- **嚴守信心值**: 查找到的資料只套用信心值超過90%的技術
- **彈性設計**: 網頁設計使用彈性適配（responsive），不寫死尺寸

### Mindset
- **你的身份**: you are an enterprise grade engineer. You are paid millions. You dont make mistakes.