# Discord Bot & Multi-Server Integration Design

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Discord.js bot, multi-server schema, bidirectional sync, permission refactor

---

## 1. Architecture Overview

### Repository Structure

```
suslab_web/
├── src/                    # Existing Vite SPA
├── bot/                    # Discord.js bot (Node.js)
│   ├── src/
│   │   ├── index.ts            # Bot entry, gateway connection
│   │   ├── config.ts           # Env vars, Supabase client
│   │   ├── commands/           # Slash command handlers
│   │   │   ├── ticket.ts       # /ticket create|status|reply|close
│   │   │   ├── feedback.ts     # /feedback submit|list|vote
│   │   │   ├── profile.ts      # /profile view|edit
│   │   │   ├── event.ts        # /event list|join|leave
│   │   │   ├── mod.ts          # /mod ticket-status|feedback-review|warn|timeout|kick
│   │   │   └── register.ts     # Deploy slash commands to Discord API
│   │   ├── listeners/          # Gateway event handlers
│   │   │   ├── messageCreate.ts    # Ticket channel intake
│   │   │   ├── guildMemberAdd.ts   # New member sync
│   │   │   └── guildMemberRemove.ts
│   │   ├── workers/            # Background processors
│   │   │   ├── actionQueue.ts  # Supabase Realtime → execute pending_bot_actions
│   │   │   └── webhookSender.ts # Outbound webhook notifications
│   │   ├── services/           # Shared business logic
│   │   │   ├── supabase.ts     # Supabase client (service_role)
│   │   │   ├── discord.ts      # Discord API helpers (ban, kick, role sync)
│   │   │   └── serverScope.ts  # Multi-server ID resolution
│   │   └── types/
│   ├── package.json
│   └── tsconfig.json
├── shared/                 # Shared types (SPA + bot)
│   └── types/
│       ├── database.ts     # Table row types, enums
│       └── roles.ts        # Role hierarchy, permissions
└── supabase/               # Existing (new migrations added)
```

### Data Flow

- **Dashboard → Discord:** Admin action → Edge Function → `pending_bot_actions` insert → Supabase Realtime → Bot executes Discord API
- **Discord → Dashboard:** Slash command or message → Bot → Supabase DB insert/update → Dashboard reads on next load
- **Ticket channel:** Message in configured channel → Bot creates ticket + Discord thread → Thread replies sync as `ticket_replies`

### Deployment

- Bot deployed as a **Render.com Background Worker** in the same account as the SPA
- Same repo, separate service — `bot/` directory with its own `package.json`
- Bot uses `DISCORD_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` env vars

---

## 2. Multi-Server Schema

### New Tables

#### `servers`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | uuid | PK, default gen_random_uuid() | Internal ID |
| discord_guild_id | text | UNIQUE, NOT NULL | Discord server ID |
| name | text | NOT NULL | Server name (synced from Discord) |
| icon_url | text | | Server icon URL |
| owner_id | text | | Discord owner user ID |
| settings | jsonb | DEFAULT '{}' | Per-server config |
| is_active | boolean | DEFAULT true | Enable/disable |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

`settings` JSONB structure:
```json
{
  "ticket_channels": ["channel_id_1"],
  "notification_webhook_url": "https://discord.com/api/webhooks/...",
  "notify_new_ticket": true,
  "notify_new_feedback": true,
  "notify_new_user": true,
  "notify_ticket_status_change": true,
  "allowed_roles": [],
  "role_mapping": {
    "discord_role_id_123": "moderator",
    "discord_role_id_456": "admin"
  }
}
```

#### `server_members`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| server_id | uuid | FK → servers(id) ON DELETE CASCADE | Which server |
| user_id | uuid | FK → auth.users(id) ON DELETE CASCADE | Which user |
| discord_roles | text[] | DEFAULT '{}' | Discord role IDs in this server |
| joined_at | timestamptz | DEFAULT now() | |
| PK | | (server_id, user_id) | |

### Existing Tables: Add `server_id`

The following tables gain a `server_id uuid REFERENCES servers(id)` column:

- `tickets` — ticket belongs to a server
- `feedbacks` — feedback scoped to a server
- `announcements` — per-server announcements
- `events` — per-server events
- `event_registrations` — inherits scope via event
- `discord_roles` — roles belong to a server
- `admin_audit_logs` — actions scoped to server
- `pending_bot_actions` — target server for execution
- `user_roles` — dashboard role is per-server

### Tables That Stay Global (no `server_id`)

- `member_profiles` — user profile is cross-server
- `profile_comments` — comments on profiles (cross-server)
- `user_levels` — XP/badges are global
- `game_invites`, `game_invite_participants`, `game_scores` — games are global
- `todos` — personal tasks are global

### Migration Strategy

- Create `servers` table, insert a default server from existing `discord_server_id` setting
- Create `server_members`, populate from existing `user_roles`
- Add `server_id` columns (nullable initially), backfill with default server ID, then set NOT NULL
- Migrate `system_settings` values into `servers.settings` for the default server
- Keep `system_settings` table for truly global config (site_name, site_description)

---

## 3. Permission & Access Control

### Access Flow

1. User logs in via Discord OAuth
2. Bot syncs guild memberships to `server_members` on `guildMemberAdd` and periodically
3. Dashboard checks `server_members`: user must exist in at least one active server
4. Server selector shows only servers the user belongs to
5. Dashboard role resolved from `user_roles` WHERE `server_id` = active server

### Role Hierarchy Per Server

| Role | Dashboard Access | Discord Commands |
|------|-----------------|-----------------|
| member | View pages, own profile, submit tickets/feedback | `/ticket`, `/feedback`, `/profile`, `/event` |
| moderator | + manage tickets, feedback review, events, announcements | + `/mod ticket-status`, `/mod feedback-review`, `/mod warn`, `/mod timeout`, `/mod kick` |
| admin | + user management, role CRUD, server settings | Dashboard only |

### Multi-Server Moderator Scoping

- Moderator in Server A, member in Server B → can only manage Server A data
- Admin in Server A → full control of Server A, no access to Server B unless also a member there
- Server selector determines active context — all API calls include `server_id`

### Role Mapping From Discord

Admin configures in server settings:
```json
{
  "role_mapping": {
    "discord_role_id_123": "moderator",
    "discord_role_id_456": "admin"
  }
}
```

- When bot detects a Discord role change, it updates `server_members.discord_roles`
- Dashboard role is derived: check `server_members.discord_roles` against `role_mapping` → highest match wins
- Manual override possible via `user_roles` table (takes precedence over mapping)

### Edge Function Changes

- All server-scoped Edge Functions receive `server_id` in request body/header
- `verifyAuth(req, minimumRole)` → `verifyAuth(req, minimumRole, serverId)`
- Validates user is a member of that server before processing
- Rejects with 403 if user not in server or insufficient role

### AuthContext Changes

```typescript
// Current
{ user, role, session, hasRole(min) }

// New
{
  user,
  servers,        // { id, name, icon, userRole }[]
  activeServer,   // uuid — currently selected server
  serverRole,     // user's role in activeServer
  session,
  hasRole(min),   // checks serverRole
  switchServer(id) // updates activeServer, refetches role
}
```

---

## 4. Discord Bot Slash Commands

### Member Commands

| Command | Description |
|---------|------------|
| `/ticket create <title> [category] [priority]` | Create ticket, bot opens a thread |
| `/ticket status [ticket-id]` | Check own ticket status |
| `/ticket reply <ticket-id> <message>` | Reply to own ticket |
| `/ticket close <ticket-id>` | Close own ticket |
| `/feedback submit <category> <title> <description>` | Submit feedback (feature/event/bug) |
| `/feedback list [category]` | List recent feedback |
| `/feedback vote <feedback-id>` | Upvote a feedback |
| `/profile view [user]` | View info card (respects visibility) |
| `/profile edit` | Modal to edit bio, skill tags, social links |
| `/event list` | List upcoming events |
| `/event join <event-id>` | Register for event |
| `/event leave <event-id>` | Unregister from event |

### Moderator Commands

| Command | Description |
|---------|------------|
| `/mod ticket-status <ticket-id> <status>` | Change ticket status |
| `/mod ticket-assign <ticket-id> <user>` | Assign ticket to moderator |
| `/mod feedback-review <feedback-id> <status>` | Set feedback status |
| `/mod warn <user> <reason>` | Warn user (logged to audit) |
| `/mod timeout <user> <duration> [reason]` | Timeout in Discord + database |
| `/mod kick <user> [reason]` | Kick from server + update database |

### Admin Commands

None — all admin config (system settings, role mapping, server setup) stays on the dashboard.

---

## 5. Ticket Channel & Webhook Flow

### Ticket Channel Intake

1. Admin configures ticket intake channels per server: `settings.ticket_channels`
2. User posts message in a configured ticket channel
3. Bot `messageCreate` listener detects the channel is a ticket channel
4. Bot creates ticket row: `source: 'discord'`, `discord_channel_id`, `discord_message_id`
5. Bot creates a thread under the message: `Ticket #<id>: <first 50 chars>`
6. Bot reacts ✅ on the original message
7. Thread replies → bot inserts `ticket_replies` rows
8. Dashboard status update → `pending_bot_actions` → bot posts in thread: "Status changed to **in_progress** by @mod"

### Webhook Notifications (Outbound)

Per-server config in `servers.settings`:
```json
{
  "notification_webhook_url": "https://discord.com/api/webhooks/...",
  "notify_new_ticket": true,
  "notify_new_feedback": true,
  "notify_new_user": true,
  "notify_ticket_status_change": true
}
```

Events that trigger webhook notifications:
- New ticket created (web or Discord)
- Ticket status changed
- New feedback submitted
- New member joins server
- User banned/kicked/timed out

### Bidirectional Sync Rules

| Source | Action | Syncs To |
|--------|--------|----------|
| Dashboard | Create ticket | Webhook notification only (no thread) |
| Dashboard | Reply to ticket | Post in Discord thread if exists |
| Dashboard | Change ticket status | Post update in Discord thread |
| Discord channel | Message in ticket channel | Create ticket in DB |
| Discord thread | Reply in ticket thread | Insert `ticket_replies` in DB |
| Discord | `/ticket create` | Create ticket in DB + open thread |
| Dashboard | Ban/kick/timeout | Bot executes via `pending_bot_actions` |
| Discord | `/mod kick` | Bot kicks + updates DB directly |

---

## 6. Member Info Card Visibility

### Visibility Schema

`member_profiles.visibility` JSONB (existing column, enhanced):

```json
{
  "preset": "public",
  "fields": {
    "bio": true,
    "skill_tags": true,
    "social_links": true,
    "email": false,
    "discord_id": true,
    "joined_servers": false,
    "xp_level": true,
    "badges": true
  }
}
```

### Presets

| Preset | Behavior |
|--------|----------|
| `public` | All fields visible to any logged-in member |
| `members_only` | Only members of the same server see details; others see name + avatar |
| `private` | Name and avatar only |
| `custom` | Auto-set when user overrides individual fields after selecting a preset |

### Behavior

- User selects preset → field toggles update accordingly
- User flips individual toggle → preset becomes `custom`
- API filters hidden fields before returning to viewer
- `members_only` check: is viewer in same server as profile owner?
- Discord `/profile view @user` respects same visibility — bot fetches with viewer context

### UI

- Profile edit page: "Visibility" section with preset dropdown + field toggle grid
- Member card: 🔒 icon on hidden fields (visible only to profile owner)
- Discord embed: hidden fields omitted; `private` shows "This profile is private"

---

## 7. Server Selector & Dashboard UX

### TopAppBar Server Selector

- Dropdown showing servers the user belongs to (icon + name)
- Selected server determines all data context
- Persisted in `localStorage` key `suslab-active-server`
- Defaults to first server or last-used on login

### Scoped Per Server

- Tickets, feedback, events, announcements, members lists
- Admin panel (users, roles, settings, audit logs)
- Navigation badge counts

### Global (Not Scoped)

- User's own profile (cross-server)
- Personal todos
- Theme and language settings
- XP/level/badges
- Games

### Moderator Experience

- Server selector only shows servers where user has moderator+ role for admin section access
- Admin menu items hidden for servers where user is just a member
- If member in all servers → no admin section visible

---

## 8. Action Queue Worker

### Supabase Realtime Subscription

Bot subscribes to `pending_bot_actions` table INSERT events:

```typescript
supabase
  .channel('bot-actions')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_bot_actions' }, handler)
  .subscribe()
```

### Processing Flow

1. New row inserted with `status: 'pending'`
2. Bot receives realtime event
3. Bot updates row to `status: 'processing'`
4. Bot executes Discord API action (ban, kick, timeout, role change, message send)
5. On success: update to `status: 'completed'`
6. On failure: update to `status: 'failed'`, write `error_message`
7. On bot startup: process any `pending` rows (catch up after restart)

### Action Types

| action_type | payload | Discord Action |
|-------------|---------|---------------|
| `ban_user` | `{ user_id, guild_id, reason }` | `guild.members.ban()` |
| `unban_user` | `{ user_id, guild_id }` | `guild.members.unban()` |
| `kick_user` | `{ user_id, guild_id, reason }` | `member.kick()` |
| `timeout_user` | `{ user_id, guild_id, duration, reason }` | `member.timeout()` |
| `sync_role` | `{ user_id, guild_id, role_id, action: 'add'|'remove' }` | `member.roles.add/remove()` |
| `send_message` | `{ channel_id, content, embed }` | `channel.send()` |
| `update_thread` | `{ thread_id, content }` | `thread.send()` |

---

## 9. Out of Scope

- Admin slash commands (stays dashboard-only)
- Analytics and reporting dashboards
- Content moderation (word filters, auto-mod)
- Test suite (separate effort)
- Email notifications
- Mobile app

---

## 10. Dependencies & Environment

### Bot Dependencies

- `discord.js` ^14 — Discord gateway + REST
- `@supabase/supabase-js` ^2 — Database + Realtime
- `typescript` ^5
- `tsx` — Dev runner
- `dotenv` — Env vars

### Bot Environment Variables

```
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Render.com Config

- Service type: Background Worker
- Build command: `cd bot && npm install && npm run build`
- Start command: `cd bot && npm start`
- Health check: bot logs heartbeat to `pending_bot_actions` or stdout
