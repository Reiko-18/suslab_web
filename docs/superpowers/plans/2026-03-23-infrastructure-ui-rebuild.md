# Infrastructure + UI Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SusLab web platform from custom CSS to MUI v6 with MD3-inspired Dynamic Color, i18n (en/ja/zh-CN/zh-TW), and Navigation Rail + Drawer layout.

**Architecture:** MUI v6 with Emotion for all UI. `@material/material-color-utilities` generates tonal palettes from a seed color, mapped to MUI's `createTheme()`. `react-i18next` handles 4-language i18n with JSON files bundled in `src/i18n/locales/`. Navigation uses a collapsible Rail (72px) / Drawer (240px) hybrid with Bottom Navigation on mobile. Existing Edge Functions and auth preserved.

**Tech Stack:** React 19, MUI v6, Emotion, @material/material-color-utilities, react-i18next, react-router-dom v7, Supabase, Vite

**Spec:** `docs/superpowers/specs/2026-03-23-infrastructure-ui-rebuild-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/theme/colorUtils.js` | Seed color → MD3 tonal palette → MUI palette mapping |
| `src/theme/useThemeSettings.js` | localStorage hook for theme mode + seed color |
| `src/theme/ThemeProvider.jsx` | MUI ThemeProvider + CssBaseline + Dynamic Color |
| `src/i18n/index.js` | i18next initialization + language detector |
| `src/i18n/locales/en.json` | English translations |
| `src/i18n/locales/ja.json` | Japanese translations |
| `src/i18n/locales/zh-CN.json` | Simplified Chinese translations |
| `src/i18n/locales/zh-TW.json` | Traditional Chinese translations |
| `src/components/NavRail.jsx` | 72px collapsed navigation rail |
| `src/components/NavDrawer.jsx` | 240px expanded navigation drawer |
| `src/components/TopAppBar.jsx` | App bar with title + theme/language/user controls |
| `src/components/ThemeColorPicker.jsx` | Seed color picker popover |
| `src/components/LanguageSelector.jsx` | Language switcher menu |
| `src/layouts/AppLayout.jsx` | Authenticated layout with Rail/Drawer + TopAppBar + Outlet |
| `src/layouts/PublicLayout.jsx` | Public layout for landing page |
| `src/pages/Landing.jsx` | Public landing page |
| `src/pages/Home.jsx` | Welcome dashboard (stub) |
| `src/pages/Members.jsx` | Member list (stub) |
| `src/pages/Events.jsx` | Events page (functional, replaces Dashboard) |
| `src/pages/Todos.jsx` | To-do list (stub) |
| `src/pages/Announcements.jsx` | Announcements (stub) |
| `src/pages/Games.jsx` | Minigames (stub) |
| `src/pages/Feedback.jsx` | User feedback (stub) |
| `src/pages/admin/Roles.jsx` | Role management (stub) |
| `src/pages/admin/Users.jsx` | User management (functional, replaces Admin) |
| `src/pages/admin/Tickets.jsx` | Tickets (stub) |
| `src/pages/admin/FeedbackReview.jsx` | Feedback review (stub) |
| `src/pages/admin/Settings.jsx` | System settings (stub) |

### Modified files

| File | Changes |
|------|---------|
| `package.json` | Add MUI/i18n deps, remove lucide-react |
| `index.html` | Update fonts, change lang to "en" |
| `src/main.jsx` | Wrap with ThemeProvider, import i18n |
| `src/App.jsx` | New route structure with layouts |
| `src/components/ProtectedRoute.jsx` | Restyle with MUI + i18n |
| `src/pages/Profile.jsx` | Restyle with MUI + i18n (preserve functionality) |
| `src/pages/AuthCallback.jsx` | Restyle with MUI CircularProgress |

### Deleted files

| File | Reason |
|------|--------|
| `src/index.css` | Replaced by MUI CssBaseline |
| `src/App.css` | No longer needed |
| `src/pages/Dashboard.jsx` | Replaced by Events.jsx |
| `src/pages/Dashboard.css` | No longer needed |
| `src/pages/Profile.css` | Styles moved to sx prop |
| `src/pages/Admin.jsx` | Replaced by admin/Users.jsx |
| `src/pages/Admin.css` | No longer needed |
| `src/pages/Home.css` | No longer needed |
| `src/components/Navbar.jsx` | Replaced by NavRail/NavDrawer/TopAppBar |
| `src/components/Navbar.css` | No longer needed |
| `src/components/Button.jsx` | Replaced by MUI Button |

---

## Task 1: Install Dependencies + Update index.html

**Files:**
- Modify: `package.json`
- Modify: `index.html`

- [ ] **Step 1: Install new dependencies**

```bash
cd d:/suslab_web
npm install @mui/material@^6 @mui/icons-material@^6 @emotion/react@^11 @emotion/styled@^11 @material/material-color-utilities react-i18next i18next i18next-browser-languagedetector
```

- [ ] **Step 2: Remove lucide-react**

```bash
npm uninstall lucide-react
```

- [ ] **Step 3: Update index.html**

Replace the entire contents of `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet" />
    <title>SusLab</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json index.html
git commit -m "feat: install MUI v6, i18n deps, update fonts"
```

---

## Task 2: Theme System

**Files:**
- Create: `src/theme/colorUtils.js`
- Create: `src/theme/useThemeSettings.js`
- Create: `src/theme/ThemeProvider.jsx`

- [ ] **Step 1: Create colorUtils.js**

```javascript
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
```

- [ ] **Step 2: Create useThemeSettings.js**

```javascript
import { useState, useCallback } from 'react'

const MODE_KEY = 'suslab-theme-mode'
const SEED_KEY = 'suslab-theme-seed'
const DEFAULT_SEED = '#6750A4'

function getStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function useThemeSettings() {
  const [mode, setModeState] = useState(() => getStored(MODE_KEY, 'light'))
  const [seedColor, setSeedState] = useState(() => getStored(SEED_KEY, DEFAULT_SEED))

  const setMode = useCallback((m) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
  }, [])

  const setSeedColor = useCallback((c) => {
    setSeedState(c)
    localStorage.setItem(SEED_KEY, c)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(MODE_KEY, next)
      return next
    })
  }, [])

  return { mode, seedColor, setMode, setSeedColor, toggleMode }
}
```

- [ ] **Step 3: Create ThemeProvider.jsx**

```jsx
import { useMemo, createContext, useContext } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useThemeSettings } from './useThemeSettings'
import { generateMuiPalette } from './colorUtils'

const ThemeSettingsContext = createContext(null)

export function useThemeControls() {
  return useContext(ThemeSettingsContext)
}

export default function ThemeProvider({ children }) {
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
```

- [ ] **Step 4: Commit**

```bash
git add src/theme/
git commit -m "feat: add theme system with Dynamic Color + light/dark mode"
```

---

## Task 3: i18n Setup

**Files:**
- Create: `src/i18n/index.js`
- Create: `src/i18n/locales/en.json`
- Create: `src/i18n/locales/ja.json`
- Create: `src/i18n/locales/zh-CN.json`
- Create: `src/i18n/locales/zh-TW.json`

- [ ] **Step 1: Create i18n/index.js**

```javascript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'suslab-language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

document.documentElement.lang = i18n.language

export default i18n
```

- [ ] **Step 2: Create locales/en.json**

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
  "profile.roles.admin": "Admin",
  "profile.roles.moderator": "Moderator",
  "profile.roles.member": "Member",
  "admin.users.title": "User Management",
  "admin.users.desc": "Manage community member roles and permissions",
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
  "events.attendees": "{{count}} attending",
  "events.loadError": "Failed to load events"
}
```

- [ ] **Step 3: Create locales/ja.json**

```json
{
  "nav.home": "ホーム",
  "nav.members": "メンバー",
  "nav.profile": "プロフィール",
  "nav.events": "イベント",
  "nav.todos": "To-Do",
  "nav.announcements": "お知らせ",
  "nav.games": "ゲーム",
  "nav.feedback": "フィードバック",
  "nav.admin.roles": "ロール",
  "nav.admin.users": "ユーザー",
  "nav.admin.tickets": "チケット",
  "nav.admin.feedbackReview": "フィードバック管理",
  "nav.admin.settings": "設定",
  "nav.admin.label": "管理",
  "nav.login": "Discordでログイン",
  "theme.light": "ライトモード",
  "theme.dark": "ダークモード",
  "theme.color": "テーマカラー",
  "language.en": "English",
  "language.ja": "日本語",
  "language.zhCN": "简体中文",
  "language.zhTW": "繁體中文",
  "common.loading": "読み込み中...",
  "common.error": "エラーが発生しました",
  "common.noPermission": "アクセス拒否",
  "common.noPermissionDesc": "このページにアクセスするには{{role}}権限が必要です。",
  "common.comingSoon": "近日公開",
  "landing.hero.title": "SUS LAB",
  "landing.hero.subtitle": "ゲーマー、ミュージシャン、アーティスト、エディター、開発者のためのクリエイティブコミュニティ",
  "landing.hero.cta": "Discordで参加",
  "landing.features.title": "機能紹介",
  "landing.features.members.title": "メンバーシステム",
  "landing.features.members.desc": "仲間のクリエイターとつながり、プロフィールを閲覧",
  "landing.features.events.title": "イベント＆活動",
  "landing.features.events.desc": "コミュニティイベントやワークショップに参加",
  "landing.features.games.title": "ミニゲーム",
  "landing.features.games.desc": "メンバーと楽しいゲームをプレイ",
  "landing.features.achievements.title": "実績",
  "landing.features.achievements.desc": "参加してバッジを獲得、レベルアップ",
  "landing.features.feedback.title": "コミュニティの声",
  "landing.features.feedback.desc": "アイデアを共有してコミュニティを形作ろう",
  "landing.features.announcements.title": "お知らせ",
  "landing.features.announcements.desc": "最新のコミュニティニュースをチェック",
  "landing.stats.members": "メンバー",
  "landing.stats.events": "イベント",
  "landing.stats.partners": "パートナー",
  "landing.cta.title": "参加しませんか？",
  "landing.cta.desc": "Discordでサインインしてコミュニティに参加",
  "landing.footer.copyright": "© {{year}} SUS LAB. All rights reserved.",
  "profile.role": "ロール",
  "profile.joinDate": "参加日",
  "profile.verifiedVia": "Discord認証済み",
  "profile.logout": "ログアウト",
  "profile.roles.admin": "管理者",
  "profile.roles.moderator": "モデレーター",
  "profile.roles.member": "メンバー",
  "admin.users.title": "ユーザー管理",
  "admin.users.desc": "コミュニティメンバーのロールと権限を管理",
  "admin.users.name": "ユーザー",
  "admin.users.email": "メール",
  "admin.users.currentRole": "現在のロール",
  "admin.users.changeRole": "ロール変更",
  "admin.users.self": "（自分）",
  "admin.users.roleUpdated": "ロールが更新されました。ユーザーは再ログインが必要です。",
  "admin.users.roleUpdateFailed": "ロールの更新に失敗しました",
  "events.title": "イベント",
  "events.subtitle": "コミュニティのイベントと活動",
  "events.empty": "イベントはまだありません",
  "events.attendees": "{{count}}人参加",
  "events.loadError": "イベントの読み込みに失敗しました"
}
```

- [ ] **Step 4: Create locales/zh-CN.json**

```json
{
  "nav.home": "首页",
  "nav.members": "成员",
  "nav.profile": "个人资料",
  "nav.events": "活动",
  "nav.todos": "待办事项",
  "nav.announcements": "公告",
  "nav.games": "游戏",
  "nav.feedback": "反馈",
  "nav.admin.roles": "角色管理",
  "nav.admin.users": "用户管理",
  "nav.admin.tickets": "工单",
  "nav.admin.feedbackReview": "反馈审核",
  "nav.admin.settings": "系统设置",
  "nav.admin.label": "管理",
  "nav.login": "通过 Discord 登录",
  "theme.light": "浅色模式",
  "theme.dark": "深色模式",
  "theme.color": "主题色",
  "language.en": "English",
  "language.ja": "日本語",
  "language.zhCN": "简体中文",
  "language.zhTW": "繁體中文",
  "common.loading": "加载中...",
  "common.error": "发生错误",
  "common.noPermission": "权限不足",
  "common.noPermissionDesc": "需要 {{role}} 权限才能访问此页面。",
  "common.comingSoon": "即将推出",
  "landing.hero.title": "SUS LAB",
  "landing.hero.subtitle": "面向游戏玩家、音乐人、画师、剪辑师和开发者的创意社区",
  "landing.hero.cta": "通过 Discord 加入",
  "landing.features.title": "我们提供",
  "landing.features.members.title": "成员系统",
  "landing.features.members.desc": "与创作者们建立联系，浏览成员资料",
  "landing.features.events.title": "活动与交流",
  "landing.features.events.desc": "参加社区活动、工作坊和协作项目",
  "landing.features.games.title": "小游戏",
  "landing.features.games.desc": "与社区成员一起玩有趣的游戏",
  "landing.features.achievements.title": "成就系统",
  "landing.features.achievements.desc": "参与活动获得徽章，提升等级",
  "landing.features.feedback.title": "社区之声",
  "landing.features.feedback.desc": "分享想法，共同塑造社区未来",
  "landing.features.announcements.title": "公告",
  "landing.features.announcements.desc": "了解最新的社区动态",
  "landing.stats.members": "成员",
  "landing.stats.events": "活动",
  "landing.stats.partners": "合作伙伴",
  "landing.cta.title": "准备好加入了吗？",
  "landing.cta.desc": "通过 Discord 登录成为社区的一员",
  "landing.footer.copyright": "© {{year}} SUS LAB. 保留所有权利。",
  "profile.role": "角色",
  "profile.joinDate": "加入日期",
  "profile.verifiedVia": "通过 Discord 验证",
  "profile.logout": "退出登录",
  "profile.roles.admin": "管理员",
  "profile.roles.moderator": "版主",
  "profile.roles.member": "成员",
  "admin.users.title": "用户管理",
  "admin.users.desc": "管理社区成员角色与权限",
  "admin.users.name": "用户",
  "admin.users.email": "邮箱",
  "admin.users.currentRole": "当前角色",
  "admin.users.changeRole": "更改角色",
  "admin.users.self": "（自己）",
  "admin.users.roleUpdated": "角色已更新。用户需要重新登录才会生效。",
  "admin.users.roleUpdateFailed": "角色更新失败",
  "events.title": "活动",
  "events.subtitle": "社区活动与交流",
  "events.empty": "暂无活动",
  "events.attendees": "{{count}} 人参加",
  "events.loadError": "活动加载失败"
}
```

- [ ] **Step 5: Create locales/zh-TW.json**

```json
{
  "nav.home": "首頁",
  "nav.members": "成員",
  "nav.profile": "個人檔案",
  "nav.events": "活動",
  "nav.todos": "待辦事項",
  "nav.announcements": "公告",
  "nav.games": "遊戲",
  "nav.feedback": "回饋",
  "nav.admin.roles": "角色管理",
  "nav.admin.users": "使用者管理",
  "nav.admin.tickets": "工單",
  "nav.admin.feedbackReview": "回饋審核",
  "nav.admin.settings": "系統設定",
  "nav.admin.label": "管理",
  "nav.login": "透過 Discord 登入",
  "theme.light": "淺色模式",
  "theme.dark": "深色模式",
  "theme.color": "主題色",
  "language.en": "English",
  "language.ja": "日本語",
  "language.zhCN": "简体中文",
  "language.zhTW": "繁體中文",
  "common.loading": "載入中...",
  "common.error": "發生錯誤",
  "common.noPermission": "權限不足",
  "common.noPermissionDesc": "需要 {{role}} 權限才能存取此頁面。",
  "common.comingSoon": "即將推出",
  "landing.hero.title": "SUS LAB",
  "landing.hero.subtitle": "面向遊戲玩家、音樂人、繪師、剪輯師和開發者的創意社群",
  "landing.hero.cta": "透過 Discord 加入",
  "landing.features.title": "我們提供",
  "landing.features.members.title": "成員系統",
  "landing.features.members.desc": "與創作者們建立連結，瀏覽成員檔案",
  "landing.features.events.title": "活動與交流",
  "landing.features.events.desc": "參加社群活動、工作坊和協作專案",
  "landing.features.games.title": "小遊戲",
  "landing.features.games.desc": "與社群成員一起玩有趣的遊戲",
  "landing.features.achievements.title": "成就系統",
  "landing.features.achievements.desc": "參與活動獲得徽章，提升等級",
  "landing.features.feedback.title": "社群之聲",
  "landing.features.feedback.desc": "分享想法，共同塑造社群未來",
  "landing.features.announcements.title": "公告",
  "landing.features.announcements.desc": "了解最新的社群動態",
  "landing.stats.members": "成員",
  "landing.stats.events": "活動",
  "landing.stats.partners": "合作夥伴",
  "landing.cta.title": "準備好加入了嗎？",
  "landing.cta.desc": "透過 Discord 登入成為社群的一員",
  "landing.footer.copyright": "© {{year}} SUS LAB. 保留所有權利。",
  "profile.role": "角色",
  "profile.joinDate": "加入日期",
  "profile.verifiedVia": "透過 Discord 驗證",
  "profile.logout": "登出",
  "profile.roles.admin": "管理員",
  "profile.roles.moderator": "版主",
  "profile.roles.member": "成員",
  "admin.users.title": "使用者管理",
  "admin.users.desc": "管理社群成員角色與權限",
  "admin.users.name": "使用者",
  "admin.users.email": "Email",
  "admin.users.currentRole": "目前角色",
  "admin.users.changeRole": "變更角色",
  "admin.users.self": "（自己）",
  "admin.users.roleUpdated": "角色已更新。該用戶需要重新登入才會生效。",
  "admin.users.roleUpdateFailed": "角色更新失敗",
  "events.title": "活動",
  "events.subtitle": "社群活動與交流",
  "events.empty": "目前沒有活動",
  "events.attendees": "{{count}} 人參加",
  "events.loadError": "活動載入失敗"
}
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n/
git commit -m "feat: add i18n with 4 languages (en, ja, zh-CN, zh-TW)"
```

---

## Task 4: Navigation Components

**Files:**
- Create: `src/components/NavRail.jsx`
- Create: `src/components/NavDrawer.jsx`
- Create: `src/components/TopAppBar.jsx`
- Create: `src/components/ThemeColorPicker.jsx`
- Create: `src/components/LanguageSelector.jsx`

- [ ] **Step 1: Create NavRail.jsx**

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import { alpha } from '@mui/material/styles'
import HomeIcon from '@mui/icons-material/Home'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CampaignIcon from '@mui/icons-material/Campaign'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import FeedbackIcon from '@mui/icons-material/Feedback'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import RateReviewIcon from '@mui/icons-material/RateReview'
import SettingsIcon from '@mui/icons-material/Settings'
import ShieldIcon from '@mui/icons-material/Shield'

const USER_NAV = [
  { key: 'nav.home', path: '/home', icon: HomeIcon },
  { key: 'nav.members', path: '/members', icon: PeopleIcon },
  { key: 'nav.events', path: '/events', icon: EventIcon },
  { key: 'nav.todos', path: '/todos', icon: ChecklistIcon },
  { key: 'nav.announcements', path: '/announcements', icon: CampaignIcon },
  { key: 'nav.games', path: '/games', icon: SportsEsportsIcon },
  { key: 'nav.feedback', path: '/feedback', icon: FeedbackIcon },
]

const ADMIN_NAV = [
  { key: 'nav.admin.roles', path: '/admin/roles', icon: ShieldIcon },
  { key: 'nav.admin.users', path: '/admin/users', icon: ManageAccountsIcon },
  { key: 'nav.admin.tickets', path: '/admin/tickets', icon: ConfirmationNumberIcon },
  { key: 'nav.admin.feedbackReview', path: '/admin/feedback', icon: RateReviewIcon },
  { key: 'nav.admin.settings', path: '/admin/settings', icon: SettingsIcon },
]

export { USER_NAV, ADMIN_NAV }

export default function NavRail({ onExpand }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const renderItem = ({ key, path, icon: Icon }) => {
    const active = location.pathname === path
    return (
      <Tooltip key={path} title={t(key)} placement="right">
        <IconButton
          onClick={() => navigate(path)}
          sx={{
            width: 48, height: 48, borderRadius: 3,
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Icon />
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <Box sx={{
      width: 72, height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1200,
      display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center',
      py: 1, gap: 0.5, bgcolor: 'background.paper', borderRight: 1, borderColor: 'divider',
    }}>
      <Tooltip title="SusLab" placement="right">
        <IconButton onClick={onExpand} sx={{ width: 48, height: 48, mb: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>S</Avatar>
        </IconButton>
      </Tooltip>

      {USER_NAV.map(renderItem)}

      {hasRole('moderator') && (
        <>
          <Divider sx={{ width: 40, my: 0.5 }} />
          {ADMIN_NAV.map(renderItem)}
        </>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Create NavDrawer.jsx**

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { USER_NAV, ADMIN_NAV } from './NavRail'

export default function NavDrawer({ open, onClose, variant = 'temporary' }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || 'User'
  const avatar = meta.avatar_url

  const handleNav = (path) => {
    navigate(path)
    if (variant === 'temporary') onClose()
  }

  const renderItem = ({ key, path, icon: Icon }) => (
    <ListItemButton
      key={path}
      selected={location.pathname === path}
      onClick={() => handleNav(path)}
      sx={{ borderRadius: 6, mx: 1, mb: 0.25 }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}><Icon /></ListItemIcon>
      <ListItemText primary={t(key)} />
    </ListItemButton>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      variant={variant}
      sx={{ '& .MuiDrawer-paper': { width: 240, boxSizing: 'border-box' } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>S</Avatar>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>SusLab</Typography>
      </Box>

      <List sx={{ flex: 1 }}>
        {USER_NAV.map(renderItem)}

        {hasRole('moderator') && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ px: 3, py: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('nav.admin.label')}
            </Typography>
            {ADMIN_NAV.map(renderItem)}
          </>
        )}
      </List>

      {user && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
          onClick={() => handleNav('/profile')}
        >
          <Avatar src={avatar} sx={{ width: 32, height: 32 }}>{displayName[0]}</Avatar>
          <Typography variant="body2" noWrap>{displayName}</Typography>
        </Box>
      )}
    </Drawer>
  )
}
```

- [ ] **Step 3: Create TopAppBar.jsx**

```jsx
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useThemeControls } from '../theme/ThemeProvider'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import MenuIcon from '@mui/icons-material/Menu'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import { useState } from 'react'
import ThemeColorPicker from './ThemeColorPicker'
import LanguageSelector from './LanguageSelector'

export default function TopAppBar({ title, onMenuClick }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { mode, toggleMode } = useThemeControls()
  const [anchorEl, setAnchorEl] = useState(null)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || 'User'
  const avatar = meta.avatar_url

  return (
    <AppBar position="fixed" color="default" elevation={0}
      sx={{ left: { xs: 0, md: 72 }, width: { xs: '100%', md: 'calc(100% - 72px)' }, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Toolbar>
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 1, display: { md: 'flex' } }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LanguageSelector />
          <IconButton onClick={toggleMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <ThemeColorPicker />

          {user && (
            <>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
                <Avatar src={avatar} sx={{ width: 32, height: 32 }}>{displayName[0]}</Avatar>
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile') }}>
                  <PersonIcon sx={{ mr: 1 }} /> {t('nav.profile')}
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); signOut() }}>
                  <LogoutIcon sx={{ mr: 1 }} /> {t('profile.logout')}
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
```

- [ ] **Step 4: Create ThemeColorPicker.jsx**

```jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeControls } from '../theme/ThemeProvider'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import PaletteIcon from '@mui/icons-material/Palette'

const PRESETS = [
  '#6750A4', '#0061A4', '#006E1C', '#984061',
  '#8B5000', '#006874', '#7D5260', '#1E6B52',
]

export default function ThemeColorPicker() {
  const { t } = useTranslation()
  const { seedColor, setSeedColor } = useThemeControls()
  const [anchorEl, setAnchorEl] = useState(null)

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
        <PaletteIcon />
      </IconButton>
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <Typography variant="subtitle2" gutterBottom>{t('theme.color')}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {PRESETS.map((color) => (
              <Box key={color} onClick={() => { setSeedColor(color); setAnchorEl(null) }}
                sx={{
                  width: 36, height: 36, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                  border: seedColor === color ? '3px solid' : '2px solid transparent',
                  borderColor: seedColor === color ? 'text.primary' : 'transparent',
                  '&:hover': { transform: 'scale(1.15)' }, transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <input type="color" value={seedColor} onChange={(e) => setSeedColor(e.target.value)}
              style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">{t('theme.color')}</Typography>
          </Box>
        </Box>
      </Popover>
    </>
  )
}
```

- [ ] **Step 5: Create LanguageSelector.jsx**

```jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import TranslateIcon from '@mui/icons-material/Translate'
import CheckIcon from '@mui/icons-material/Check'
import ListItemIcon from '@mui/material/ListItemIcon'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
]

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState(null)

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
        <TranslateIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {LANGUAGES.map(({ code, label }) => (
          <MenuItem key={code} selected={i18n.language === code}
            onClick={() => { i18n.changeLanguage(code); setAnchorEl(null) }}
          >
            <ListItemIcon>{i18n.language === code ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/NavRail.jsx src/components/NavDrawer.jsx src/components/TopAppBar.jsx src/components/ThemeColorPicker.jsx src/components/LanguageSelector.jsx
git commit -m "feat: add navigation components (NavRail, NavDrawer, TopAppBar, color picker, language selector)"
```

---

## Task 5: Layout Components

**Files:**
- Create: `src/layouts/AppLayout.jsx`
- Create: `src/layouts/PublicLayout.jsx`

- [ ] **Step 1: Create AppLayout.jsx**

```jsx
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import { useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import PersonIcon from '@mui/icons-material/Person'
import NavRail from '../components/NavRail'
import NavDrawer from '../components/NavDrawer'
import TopAppBar from '../components/TopAppBar'

const TITLE_MAP = {
  '/home': 'nav.home',
  '/members': 'nav.members',
  '/profile': 'nav.profile',
  '/events': 'nav.events',
  '/todos': 'nav.todos',
  '/announcements': 'nav.announcements',
  '/games': 'nav.games',
  '/feedback': 'nav.feedback',
  '/admin/roles': 'nav.admin.roles',
  '/admin/users': 'nav.admin.users',
  '/admin/tickets': 'nav.admin.tickets',
  '/admin/feedback': 'nav.admin.feedbackReview',
  '/admin/settings': 'nav.admin.settings',
}

const BOTTOM_NAV = [
  { path: '/home', icon: HomeIcon, key: 'nav.home' },
  { path: '/members', icon: PeopleIcon, key: 'nav.members' },
  { path: '/events', icon: EventIcon, key: 'nav.events' },
  { path: '/games', icon: SportsEsportsIcon, key: 'nav.games' },
  { path: '/profile', icon: PersonIcon, key: 'nav.profile' },
]

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const titleKey = TITLE_MAP[location.pathname] || 'nav.home'
  const bottomIdx = BOTTOM_NAV.findIndex((n) => n.path === location.pathname)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <NavRail onExpand={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <TopAppBar title={t(titleKey)} onMenuClick={() => setDrawerOpen(!drawerOpen)} />

      <Box component="main" sx={{
        flexGrow: 1, ml: { xs: 0, md: '72px' },
        mt: '64px', mb: { xs: '56px', md: 0 },
        minHeight: 'calc(100vh - 64px)',
      }}>
        <Outlet />
      </Box>

      {/* Mobile bottom navigation */}
      <BottomNavigation value={bottomIdx === -1 ? false : bottomIdx} showLabels
        sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, borderTop: 1, borderColor: 'divider' }}
      >
        {BOTTOM_NAV.map(({ path, icon: Icon, key }) => (
          <BottomNavigationAction key={path} label={t(key)} icon={<Icon />} onClick={() => navigate(path)} />
        ))}
      </BottomNavigation>
    </Box>
  )
}
```

- [ ] **Step 2: Create PublicLayout.jsx**

```jsx
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import LanguageSelector from '../components/LanguageSelector'
import ThemeColorPicker from '../components/ThemeColorPicker'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useThemeControls } from '../theme/ThemeProvider'

export default function PublicLayout() {
  const { t } = useTranslation()
  const { mode, toggleMode } = useThemeControls()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 14, fontWeight: 700, mr: 1 }}>S</Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>SusLab</Typography>
          <LanguageSelector />
          <IconButton onClick={toggleMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <ThemeColorPicker />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/layouts/
git commit -m "feat: add AppLayout and PublicLayout with responsive navigation"
```

---

## Task 6: Update ProtectedRoute + AuthCallback

**Files:**
- Modify: `src/components/ProtectedRoute.jsx`
- Modify: `src/pages/AuthCallback.jsx`

- [ ] **Step 1: Rewrite ProtectedRoute.jsx with MUI + i18n**

Note: This component supports two modes: (1) wrapping children directly, (2) acting as a layout route element using `<Outlet />` when no children are provided. This allows it to work both as `<ProtectedRoute><Page /></ProtectedRoute>` and as `<Route element={<ProtectedRoute />}>` for nested layout routes.

```jsx
import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

export default function ProtectedRoute({ children, minimumRole = 'member' }) {
  const { user, loading, hasRole } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (!hasRole(minimumRole)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Card sx={{ textAlign: 'center', maxWidth: 400, p: 4 }}>
          <Typography variant="h5" gutterBottom>{t('common.noPermission')}</Typography>
          <Typography color="text.secondary">{t('common.noPermissionDesc', { role: minimumRole })}</Typography>
        </Card>
      </Box>
    )
  }

  return children ?? <Outlet />
}
```

- [ ] **Step 2: Rewrite AuthCallback.jsx with MUI**

```jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../services/supabaseClient'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        data.subscription.unsubscribe()
        navigate('/home', { replace: true })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    </Box>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ProtectedRoute.jsx src/pages/AuthCallback.jsx
git commit -m "feat: restyle ProtectedRoute and AuthCallback with MUI + i18n"
```

---

## Task 7: Landing Page

**Files:**
- Create: `src/pages/Landing.jsx`

- [ ] **Step 1: Create Landing.jsx**

```jsx
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import FeedbackIcon from '@mui/icons-material/Feedback'
import CampaignIcon from '@mui/icons-material/Campaign'
import LoginIcon from '@mui/icons-material/Login'

const FEATURES = [
  { key: 'members', icon: PeopleIcon },
  { key: 'events', icon: EventIcon },
  { key: 'games', icon: SportsEsportsIcon },
  { key: 'achievements', icon: EmojiEventsIcon },
  { key: 'feedback', icon: FeedbackIcon },
  { key: 'announcements', icon: CampaignIcon },
]

const STATS = [
  { key: 'members', value: '500+' },
  { key: 'events', value: '120+' },
  { key: 'partners', value: '30+' },
]

export default function Landing() {
  const { t } = useTranslation()
  const { user, loading, signInWithDiscord } = useAuth()

  if (!loading && user) return <Navigate to="/home" replace />

  return (
    <Box>
      {/* Hero */}
      <Box sx={{
        py: { xs: 8, md: 14 }, textAlign: 'center',
        background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.13)}, ${alpha(theme.palette.secondary.main, 0.13)})`,
      }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>{t('landing.hero.title')}</Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            {t('landing.hero.subtitle')}
          </Typography>
          <Button variant="contained" size="large" startIcon={<LoginIcon />} onClick={signInWithDiscord}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: 3 }}
          >
            {t('landing.hero.cta')}
          </Button>
        </Container>
      </Box>

      {/* Stats */}
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" justifyContent="center" spacing={{ xs: 4, md: 8 }}>
          {STATS.map(({ key, value }) => (
            <Box key={key} sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>{value}</Typography>
              <Typography color="text.secondary">{t(`landing.stats.${key}`)}</Typography>
            </Box>
          ))}
        </Stack>
      </Container>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, textAlign: 'center', mb: 4 }}>
          {t('landing.features.title')}
        </Typography>
        <Grid container spacing={3}>
          {FEATURES.map(({ key, icon: Icon }) => (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Icon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>{t(`landing.features.${key}.title`)}</Typography>
                  <Typography color="text.secondary">{t(`landing.features.${key}.desc`)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <Paper sx={{ py: 8, textAlign: 'center', mx: 2, borderRadius: 4, mb: 4 }} elevation={0}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{t('landing.cta.title')}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{t('landing.cta.desc')}</Typography>
        <Button variant="contained" size="large" startIcon={<LoginIcon />} onClick={signInWithDiscord}>
          {t('landing.hero.cta')}
        </Button>
      </Paper>

      {/* Footer */}
      <Box sx={{ py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary">
          {t('landing.footer.copyright', { year: new Date().getFullYear() })}
        </Typography>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Landing.jsx
git commit -m "feat: add MUI landing page with i18n"
```

---

## Task 8: Functional Pages (Events, Profile, admin/Users)

**Files:**
- Create: `src/pages/Events.jsx`
- Modify: `src/pages/Profile.jsx`
- Create: `src/pages/admin/Users.jsx`

- [ ] **Step 1: Create Events.jsx (replaces Dashboard.jsx)**

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Box from '@mui/material/Box'
import EventIcon from '@mui/icons-material/Event'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PeopleIcon from '@mui/icons-material/People'

export default function Events() {
  const { t } = useTranslation()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    edgeFunctions.getEvents()
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('events.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('events.subtitle')}</Typography>

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card><CardContent><Skeleton variant="text" width="60%" /><Skeleton variant="text" /><Skeleton variant="text" width="40%" /></CardContent></Card>
            </Grid>
          ))}
        </Grid>
      ) : error ? (
        <Card sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">{t('events.loadError')}</Typography></Card>
      ) : events.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">{t('events.empty')}</Typography></Card>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Chip icon={<EventIcon />} label={event.date} size="small" color="primary" variant="outlined" sx={{ mb: 1 }} />
                  <Typography variant="h6" gutterBottom>{event.title}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>{event.description}</Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" color="action" /><Typography variant="body2">{event.time}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOnIcon fontSize="small" color="action" /><Typography variant="body2">{event.location}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleIcon fontSize="small" color="action" /><Typography variant="body2">{t('events.attendees', { count: event.attendees })}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  )
}
```

- [ ] **Step 2: Rewrite Profile.jsx with MUI + i18n**

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LogoutIcon from '@mui/icons-material/Logout'
import VerifiedIcon from '@mui/icons-material/Verified'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EmailIcon from '@mui/icons-material/Email'
import ShieldIcon from '@mui/icons-material/Shield'

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { user, role, loading, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    if (user) {
      edgeFunctions.getProfile().then(setProfileData).catch(console.error)
    }
  }, [user])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  if (!user) return null

  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || meta.name || 'User'
  const username = meta.user_name || meta.preferred_username
  const email = profileData?.email ?? meta.email ?? user.email
  const displayRole = profileData?.role ?? role
  const createdAt = new Date(user.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Card>
        <Box sx={{ background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, p: 4, textAlign: 'center' }}>
          <Avatar src={avatar} sx={{ width: 80, height: 80, mx: 'auto', mb: 1, border: '3px solid white', fontSize: 32 }}>
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>{displayName}</Typography>
          {username && <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>@{username}</Typography>}
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ShieldIcon color="primary" />
              <Typography>{t('profile.role')}</Typography>
              <Chip label={t(`profile.roles.${displayRole}`) || displayRole} size="small" color="primary" sx={{ ml: 'auto' }} />
            </Box>
            <Divider />
            {email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EmailIcon color="action" /><Typography>{email}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CalendarMonthIcon color="action" /><Typography>{t('profile.joinDate')}: {createdAt}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <VerifiedIcon color="action" /><Typography>{t('profile.verifiedVia')}</Typography>
            </Box>
          </Stack>
          <Button variant="outlined" color="error" startIcon={<LogoutIcon />} fullWidth sx={{ mt: 3 }} onClick={signOut}>
            {t('profile.logout')}
          </Button>
        </CardContent>
      </Card>
    </Container>
  )
}
```

- [ ] **Step 3: Create admin/Users.jsx (replaces Admin.jsx)**

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    edgeFunctions.getUsers()
      .then((data) => setUsers(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(userId, newRole) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      setNotice(t('admin.users.roleUpdated'))
    } catch (err) {
      setNotice(err.message ?? t('admin.users.roleUpdateFailed'))
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('admin.users.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('admin.users.desc')}</Typography>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.users.name')}</TableCell>
              <TableCell>{t('admin.users.email')}</TableCell>
              <TableCell>{t('admin.users.currentRole')}</TableCell>
              <TableCell>{t('admin.users.changeRole')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={u.avatar_url} sx={{ width: 32, height: 32 }}>{(u.display_name || '?')[0]}</Avatar>
                    {u.display_name}
                  </Box>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip label={t(`profile.roles.${u.role}`) || u.role} size="small"
                    color={u.role === 'admin' ? 'error' : u.role === 'moderator' ? 'warning' : 'primary'} />
                </TableCell>
                <TableCell>
                  {u.id === currentUser?.id ? (
                    <Typography variant="body2" color="text.secondary">{t('admin.users.self')}</Typography>
                  ) : (
                    <Select value={u.role} size="small" onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      <MenuItem value="member">{t('profile.roles.member')}</MenuItem>
                      <MenuItem value="moderator">{t('profile.roles.moderator')}</MenuItem>
                      <MenuItem value="admin">{t('profile.roles.admin')}</MenuItem>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}
```

- [ ] **Step 4: Create admin directory and commit**

```bash
mkdir -p src/pages/admin
git add src/pages/Events.jsx src/pages/Profile.jsx src/pages/admin/Users.jsx
git commit -m "feat: add functional pages (Events, Profile, admin/Users) with MUI + i18n"
```

---

## Task 9: Stub Pages

**Files:**
- Create: `src/pages/Home.jsx`, `src/pages/Members.jsx`, `src/pages/Todos.jsx`, `src/pages/Announcements.jsx`, `src/pages/Games.jsx`, `src/pages/Feedback.jsx`
- Create: `src/pages/admin/Roles.jsx`, `src/pages/admin/Tickets.jsx`, `src/pages/admin/FeedbackReview.jsx`, `src/pages/admin/Settings.jsx`

- [ ] **Step 1: Create all stub pages**

Each stub page follows the same pattern. Create each file:

**src/pages/Home.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Home() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.home')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/Members.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Members() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.members')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/Todos.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Todos() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.todos')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/Announcements.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Announcements() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.announcements')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/Games.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Games() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.games')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/Feedback.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Feedback() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.feedback')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/admin/Roles.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Roles() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.admin.roles')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/admin/Tickets.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Tickets() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.admin.tickets')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/admin/FeedbackReview.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function FeedbackReview() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.admin.feedbackReview')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

**src/pages/admin/Settings.jsx:**
```jsx
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Settings() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.admin.settings')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Home.jsx src/pages/Members.jsx src/pages/Todos.jsx src/pages/Announcements.jsx src/pages/Games.jsx src/pages/Feedback.jsx src/pages/admin/Roles.jsx src/pages/admin/Tickets.jsx src/pages/admin/FeedbackReview.jsx src/pages/admin/Settings.jsx
git commit -m "feat: add stub pages for all user and admin routes"
```

---

## Task 10: App.jsx + main.jsx Routing

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Rewrite App.jsx with new route structure**

```jsx
import { Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import PublicLayout from './layouts/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Members from './pages/Members'
import Profile from './pages/Profile'
import Events from './pages/Events'
import Todos from './pages/Todos'
import Announcements from './pages/Announcements'
import Games from './pages/Games'
import Feedback from './pages/Feedback'
import Roles from './pages/admin/Roles'
import AdminUsers from './pages/admin/Users'
import Tickets from './pages/admin/Tickets'
import FeedbackReview from './pages/admin/FeedbackReview'
import Settings from './pages/admin/Settings'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>

      {/* Authenticated routes — ProtectedRoute renders <Outlet /> when no children */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/members" element={<Members />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/events" element={<Events />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/games" element={<Games />} />
          <Route path="/feedback" element={<Feedback />} />

          {/* Admin routes (moderator+) */}
          <Route element={<ProtectedRoute minimumRole="moderator" />}>
            <Route path="/admin/roles" element={<Roles />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/tickets" element={<Tickets />} />
            <Route path="/admin/feedback" element={<FeedbackReview />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Rewrite main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ThemeProvider from './theme/ThemeProvider'
import './i18n'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "feat: new route structure with AppLayout, PublicLayout, and nested routes"
```

---

## Task 11: Delete Old Files + Build Verification

**Files:**
- Delete: `src/index.css`, `src/App.css`, `src/pages/Dashboard.jsx`, `src/pages/Dashboard.css`, `src/pages/Profile.css`, `src/pages/Admin.jsx`, `src/pages/Admin.css`, `src/components/Navbar.jsx`, `src/components/Navbar.css`, `src/components/Button.jsx`

- [ ] **Step 1: Delete all old CSS and replaced component files**

```bash
cd d:/suslab_web
rm -f src/index.css src/App.css src/pages/Dashboard.jsx src/pages/Dashboard.css src/pages/Profile.css src/pages/Home.css src/pages/Admin.jsx src/pages/Admin.css src/components/Navbar.jsx src/components/Navbar.css src/components/Button.jsx
```

- [ ] **Step 2: Build to verify no errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: complete MUI + i18n rebuild, remove old CSS and components"
git push
```
