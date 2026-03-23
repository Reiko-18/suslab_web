# Sub-project 2 Batch B: User Interface — Interactive Features Design

## Overview

Implement the interactive user features: Todos (personal + community), Games (2048 + invite system), Feedback (with voting), and Events enhancement (registration + level/badge system). Builds on Batch A infrastructure.

## Scope

| Page | Type | Features |
|------|------|----------|
| Todos (`/todos`) | Rewrite stub | Personal + community to-do list with claim system |
| Games (`/games`) | Rewrite stub | 2048 game with leaderboard + game invite system |
| Feedback (`/feedback`) | Rewrite stub | Categorized feedback with upvoting, moderator status management |
| Events (`/events`) | Enhance existing | Event registration + level/XP/badge system |

## What's NOT in scope

- Admin dashboard features (Sub-project 3)
- Discord bot integration (Sub-project 4)
- Additional minigames beyond 2048

---

## 1. Database Tables

### `todos`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Todo ID |
| `user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Creator |
| `title` | text NOT NULL (CHECK char_length BETWEEN 1 AND 200) | Title |
| `completed` | boolean (default false) | Completion status |
| `is_public` | boolean (default false) | false=personal, true=community task |
| `assigned_to` | uuid (FK → auth.users ON DELETE SET NULL, nullable) | Claimed by (community tasks) |
| `created_at` | timestamptz (default now()) | Created |
| `updated_at` | timestamptz (default now()) | Updated |

**RLS Policies:**
- SELECT: Own todos (`user_id = auth.uid()`) OR public todos (`is_public = true`)
- INSERT: Any authenticated user, WITH CHECK (`user_id = auth.uid()`)
- UPDATE: Creator (`user_id = auth.uid()`) OR assignee (`assigned_to = auth.uid()`). **Note:** RLS grants full row UPDATE to assignees. The Edge Function `update` action must restrict assignees to only changing `completed` — the function must not allow assignees to change `title` or other fields. Implemented by checking `user_id` vs `assigned_to` in the function and building the appropriate update object.
- DELETE: Creator only (`user_id = auth.uid()`)

### `game_invites`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Invite ID |
| `host_id` | uuid (FK → auth.users ON DELETE CASCADE) | Host |
| `game_type` | text NOT NULL | `'2048'` or `'external'` |
| `title` | text NOT NULL (CHECK char_length BETWEEN 1 AND 100) | Title |
| `description` | text (CHECK char_length <= 500) | Description (external games) |
| `max_players` | integer (default 4, CHECK > 0) | Max players |
| `status` | text (default 'open', CHECK IN ('open', 'in_progress', 'closed')) | Status |
| `created_at` | timestamptz (default now()) | Created |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`host_id = auth.uid()`)
- UPDATE: Host only (`host_id = auth.uid()`)
- DELETE: Host (`host_id = auth.uid()`) or admin (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`)

### `game_invite_participants`

| Column | Type | Description |
|--------|------|-------------|
| `invite_id` | uuid (FK → game_invites ON DELETE CASCADE) | Invite |
| `user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Participant |
| `joined_at` | timestamptz (default now()) | Joined |
| PK | (invite_id, user_id) | Composite primary key |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`user_id = auth.uid()`)
- DELETE: Own participation only (`user_id = auth.uid()`)

### `game_scores`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Score ID |
| `user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Player |
| `game_type` | text NOT NULL | `'2048'` |
| `score` | integer NOT NULL (CHECK >= 0) | Score |
| `created_at` | timestamptz (default now()) | Recorded |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`user_id = auth.uid()`)
- No UPDATE or DELETE (scores are permanent)

### `feedbacks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Feedback ID |
| `author_id` | uuid (FK → auth.users ON DELETE CASCADE) | Author |
| `category` | text NOT NULL (CHECK IN ('feature', 'event', 'bug')) | Category |
| `title` | text NOT NULL (CHECK char_length BETWEEN 1 AND 200) | Title |
| `content` | text NOT NULL (CHECK char_length BETWEEN 1 AND 2000) | Content |
| `status` | text (default 'open', CHECK IN ('open', 'reviewed', 'accepted', 'rejected')) | Status |
| `vote_count` | integer (default 0) | Denormalized vote count |
| `created_at` | timestamptz (default now()) | Created |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`author_id = auth.uid()`)
- UPDATE: Moderator+ (RLS grants full row UPDATE). **Edge Function enforcement:** The `update-status` action must build an update object containing only `{ status }` — never spread the request body. This ensures moderators can only change status, not title/content/category.
- DELETE: Author (`author_id = auth.uid()`) or admin. **Note:** This allows direct client deletion bypassing the Edge Function. Accepted trade-off for current scope — if audit trail is needed later (Sub-project 4), restrict DELETE to service role only.

### `feedback_votes`

| Column | Type | Description |
|--------|------|-------------|
| `feedback_id` | uuid (FK → feedbacks ON DELETE CASCADE) | Feedback |
| `user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Voter |
| PK | (feedback_id, user_id) | Composite PK (one vote per user) |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`user_id = auth.uid()`)
- DELETE: Own vote only (`user_id = auth.uid()`)

### `event_registrations`

| Column | Type | Description |
|--------|------|-------------|
| `event_id` | uuid (FK → events ON DELETE CASCADE) | Event |
| `user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Registrant |
| `registered_at` | timestamptz (default now()) | Registered |
| PK | (event_id, user_id) | Composite PK |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`user_id = auth.uid()`)
- DELETE: Own registration (`user_id = auth.uid()`) or admin

### `user_levels`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK, FK → auth.users ON DELETE CASCADE) | User |
| `xp` | integer (default 0, CHECK >= 0) | Experience points |
| `level` | integer (default 1, CHECK >= 1) | Level |
| `badges` | text[] (default '{}') | Badge array |
| `updated_at` | timestamptz (default now()) | Updated |

**Auto-create trigger:** Named `on_auth_user_created_levels` on `auth.users` INSERT, creates `user_levels` row with defaults. SECURITY DEFINER. Backfill migration for existing users who don't have a row.

**XP Rules:**
- Register for event: +10 XP
- Submit feedback: +5 XP
- Complete a todo: +2 XP

**Level formula:** `level = floor(sqrt(xp / 10)) + 1`

**RLS Policies:**
- SELECT: Any authenticated user
- UPDATE: No direct update (only via Edge Functions with service client)
- INSERT: No direct insert (trigger only)

---

## 2. Edge Functions

### `manage-todos`

- **Minimum role:** member
- **Actions:**
  - `list` — Own personal todos + all public todos. Paginated `{ page?, pageSize? }`. Returns `{ todos, total }`.
  - `create` — Create todo with `{ title, is_public }`. Sets `user_id` to auth user.
  - `update` — Update `{ id, title?, completed? }`. Only creator or assignee.
  - `delete` — Delete by `id`. Only creator.
  - `claim` — Set `assigned_to` to auth user on a public unclaimed todo.
  - `unclaim` — Remove `assigned_to` from a todo where current user is assignee.

XP integration: When `update` sets `completed = true`, call internal XP add (+2).

### `manage-games`

- **Minimum role:** member
- **Actions:**
  - `list-invites` — Get open game invites with participant count + host info. Paginated.
  - `create-invite` — Create invite with `{ game_type, title, description?, max_players? }`.
  - `join-invite` — Join invite by `id`. Check max_players not exceeded.
  - `leave-invite` — Leave invite by `id`.
  - `close-invite` — Set status to 'closed'. Host only.
  - `submit-score` — Record 2048 score `{ score }`. Only stores if higher than user's existing best.
  - `leaderboard` — Top 20 scores for 2048 with user display names + avatars.

### `manage-feedbacks`

- **Minimum role:** member (read/write) / moderator (status changes)
- **Actions:**
  - `list` — All feedbacks, optional `{ category? }` filter. Ordered by `vote_count DESC`. Paginated. Returns each feedback with `has_voted` boolean for current user.
  - `create` — Create with `{ category, title, content }`. Sets `author_id`. Awards +5 XP.
  - `vote` — Toggle vote on `{ feedback_id }`. If already voted → remove vote and decrement count. If not → add vote and increment count.
  - `update-status` — Change `{ id, status }`. Moderator+ only.
  - `delete` — Delete by `id`. Author or admin only.

### `manage-events` (modify existing)

**Important role change:** The existing `manage-events` function calls `verifyAuth(req, 'moderator')` at the top. This must be lowered to `verifyAuth(req, 'member')` since the new registration actions need member access. The existing `create`, `update`, `delete` actions must add inline role checks (`if (role !== 'moderator' && role !== 'admin') return errorResponse(...)`) to maintain their moderator+ restriction.

Add new actions:
  - `register` — Register for event `{ event_id }`. Awards +10 XP. Minimum role: member.
  - `unregister` — Cancel registration `{ event_id }`. Minimum role: member.
  - `registrations` — Get registrants for `{ event_id }` with display names + avatars. Minimum role: member.

Also add to `get-events`: return a `registered` boolean per event for the current user by LEFT JOINing `event_registrations` on the user's ID + counting registrations as `registration_count`.

### `manage-levels`

- **Minimum role:** member
- **Actions:**
  - `get` — Get own level, XP, badges.
  - `leaderboard` — Top 20 users by XP with display names + avatars.
  - `grant-badge` — Add badge to user `{ user_id, badge }`. Admin only.

Internal function (not exposed as action): `addXp(userId, amount)` — adds XP to user, recalculates level. Uses service client to bypass RLS. Called by other Edge Functions.

**XP helper pattern:** Since multiple Edge Functions need to award XP, the XP logic is implemented as a shared function in `_shared/xp.ts`:

```ts
// supabase/functions/_shared/xp.ts
export async function addXp(serviceClient, userId: string, amount: number)
```

This function uses a single atomic SQL statement to prevent race conditions:
```sql
UPDATE user_levels
SET xp = xp + $amount,
    level = floor(sqrt((xp + $amount) / 10.0)) + 1,
    updated_at = now()
WHERE user_id = $userId
```
No SELECT-then-UPDATE — a single atomic UPDATE eliminates XP loss under concurrent requests.

Used by: `manage-todos` (complete), `manage-feedbacks` (create), `manage-events` (register).

---

## 3. Frontend Pages

### Todos (`/todos`)

Replaces stub. Content:

1. **Tabs** — MUI `Tabs`: personal / community
2. **Personal tab:**
   - Add todo: `TextField` + `Button` at top
   - Todo list: `List` of `TodoItem` components. Each has `Checkbox` (toggle complete), title text (strikethrough if done), delete `IconButton`.
   - Sort: incomplete first, then completed
3. **Community tab:**
   - Add public todo: `TextField` + `Button` at top
   - Task cards: `Card` list. Each shows title, creator name, status `Chip` (open/claimed/completed), claim/unclaim `Button`.
   - Claimed tasks show assignee avatar + name.

### Games (`/games`)

Replaces stub. Content:

1. **Tabs** — MUI `Tabs`: 2048 / Game Invites
2. **2048 tab:**
   - `GameBoard2048` component — 4x4 grid, keyboard (arrow keys) + touch (swipe) controls
   - Current score display + best score
   - Game over overlay with final score + "submit to leaderboard" button
   - Leaderboard below the game (top 20, `Table`)
3. **Game Invites tab:**
   - Invite list: `Grid` of `GameInviteCard`. Each shows title, game type, host, player count / max, join/leave `Button`.
   - `Fab` to create invite → `GameInviteDialog` (game_type select, title, description, max_players)
   - Host sees close button on their invites

### Feedback (`/feedback`)

Replaces stub. Content:

1. **Category filter** — `Chip` group: All / Feature / Event / Bug. Active chip highlighted.
2. **Feedback list** — Stack of `FeedbackCard`. Each shows: category `Chip` (colored), title, content preview (2 lines), author + time, status `Chip`, upvote `IconButton` + vote count.
3. **Upvote** — `ThumbUpIcon` toggles. Already voted = primary color. Count updates optimistically.
4. **Moderator** sees status `Select` dropdown on each card to change status.
5. **Create** — `Fab` → `FeedbackDialog` (category `Select` + title + content).
6. **Delete** — Author sees delete button on own feedbacks.

### Events Enhancement (`/events`)

Enhances existing. Additions:

1. **LevelCard** at top of page — Shows user's level, XP progress bar (`LinearProgress`), badge `Chip` list. Leaderboard `Button` → `LeaderboardDialog`.
2. **Event cards** — Add "Register" `Button` to each card. If registered, shows "Registered ✓" (outlined, green). Click to unregister.
3. **Expand** — Click event card → expand (MUI `Collapse`) showing registrant avatars list.

---

## 4. Frontend Components

### New components

| Component | Description |
|-----------|-------------|
| `TodoItem` | Single todo: checkbox + title + delete button |
| `GameBoard2048` | 2048 game logic + 4x4 grid UI + touch/keyboard controls |
| `GameInviteCard` | Invite card: title, game type, players, join/leave |
| `GameInviteDialog` | Create invite form dialog |
| `FeedbackCard` | Feedback card: category, title, votes, status |
| `FeedbackDialog` | Create feedback form dialog |
| `LevelCard` | Level + XP bar + badges display |
| `LeaderboardDialog` | Top 20 leaderboard. Props: `{ open, onClose, title, rows: [{ rank, displayName, avatarUrl, value }], valueLabel: string }`. Shared between levels (valueLabel="XP") and 2048 (valueLabel="Score"). Caller maps API response to the common `rows` shape. |

### Modified files

| File | Changes |
|------|---------|
| `src/pages/Todos.jsx` | Rewrite from stub |
| `src/pages/Games.jsx` | Rewrite from stub |
| `src/pages/Feedback.jsx` | Rewrite from stub |
| `src/pages/Events.jsx` | Add registration + LevelCard |
| `supabase/functions/manage-events/index.ts` | Add register/unregister/registrations actions |
| `supabase/functions/_shared/xp.ts` | New shared XP helper |
| `src/services/edgeFunctions.js` | Add all Batch B API functions |
| `src/i18n/locales/*.json` (4 files) | Add all new translation keys |

### New files (full list)

- `supabase/migrations/006_todos.sql`
- `supabase/migrations/007_games.sql`
- `supabase/migrations/008_feedbacks.sql`
- `supabase/migrations/009_event_registrations.sql`
- `supabase/migrations/010_user_levels.sql`
- `supabase/functions/_shared/xp.ts`
- `supabase/functions/manage-todos/index.ts`
- `supabase/functions/manage-games/index.ts`
- `supabase/functions/manage-feedbacks/index.ts`
- `supabase/functions/manage-levels/index.ts`
- `src/components/TodoItem.jsx`
- `src/components/GameBoard2048.jsx`
- `src/components/GameInviteCard.jsx`
- `src/components/GameInviteDialog.jsx`
- `src/components/FeedbackCard.jsx`
- `src/components/FeedbackDialog.jsx`
- `src/components/LevelCard.jsx`
- `src/components/LeaderboardDialog.jsx`

---

## 5. New i18n Keys (English)

```
todos.title: "To-Do"
todos.personal: "Personal"
todos.community: "Community"
todos.add: "Add task"
todos.addPlaceholder: "What needs to be done?"
todos.empty: "No tasks yet"
todos.claim: "Claim"
todos.unclaim: "Unclaim"
todos.claimedBy: "Claimed by {{name}}"
todos.completed: "Completed"
todos.open: "Open"
todos.delete: "Delete"
games.title: "Games"
games.tab2048: "2048"
games.tabInvites: "Game Invites"
games.score: "Score"
games.bestScore: "Best"
games.gameOver: "Game Over!"
games.submitScore: "Submit Score"
games.scoreSubmitted: "Score submitted!"
games.newGame: "New Game"
games.leaderboard: "Leaderboard"
games.rank: "Rank"
games.player: "Player"
games.invites.title: "Game Invites"
games.invites.create: "Create Invite"
games.invites.gameType: "Game Type"
games.invites.external: "External Game"
games.invites.titleLabel: "Title"
games.invites.description: "Description"
games.invites.maxPlayers: "Max Players"
games.invites.join: "Join"
games.invites.leave: "Leave"
games.invites.close: "Close"
games.invites.players: "{{current}}/{{max}} players"
games.invites.empty: "No open invites"
games.invites.closed: "Closed"
feedback.title: "Feedback"
feedback.all: "All"
feedback.feature: "Feature"
feedback.event: "Event"
feedback.bug: "Bug"
feedback.create: "New Feedback"
feedback.titleLabel: "Title"
feedback.contentLabel: "Content"
feedback.categoryLabel: "Category"
feedback.votes: "{{count}} votes"
feedback.vote: "Vote"
feedback.status.open: "Open"
feedback.status.reviewed: "Reviewed"
feedback.status.accepted: "Accepted"
feedback.status.rejected: "Rejected"
feedback.changeStatus: "Change Status"
feedback.delete: "Delete"
feedback.confirmDelete: "Delete this feedback?"
feedback.empty: "No feedback yet. Be the first!"
feedback.created: "Feedback submitted"
feedback.deleted: "Feedback deleted"
events.register: "Register"
events.registered: "Registered"
events.unregister: "Cancel Registration"
events.registrants: "Registrants"
events.noRegistrants: "No registrants yet"
levels.title: "My Level"
levels.level: "Level {{level}}"
levels.xp: "{{current}} / {{next}} XP"
levels.badges: "Badges"
levels.noBadges: "No badges yet"
levels.leaderboard: "Level Leaderboard"
common.save: "Save"
common.cancel: "Cancel"
common.confirm: "Confirm"
```

All keys translated to ja, zh-CN, zh-TW in locale files.

---

## 6. 2048 Game Design

### Implementation

- **Pure frontend** — no backend needed during gameplay
- **4x4 grid** with CSS Grid layout
- **Controls:** Arrow keys (desktop) + touch swipe (mobile)
- **Tile colors:** Use theme primary color with varying opacity for different values (2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048)
- **Score:** Tracked in component state. Submitted to backend only on game over.
- **Best score:** Only saves if new score > existing best (checked in Edge Function)
- **Animation:** CSS transitions for tile movement and merging

### State management

All game state in component local state (no context/Redux needed):
- `board`: 4x4 number array
- `score`: current score
- `gameOver`: boolean
- `bestScore`: fetched from leaderboard on mount

---

## 7. XP System Architecture

### Shared helper: `_shared/xp.ts`

Centralized XP management function used by multiple Edge Functions. Uses service client to bypass RLS (user_levels has no direct UPDATE policy for users).

```sql
-- Single atomic statement (no race condition)
UPDATE user_levels
SET xp = xp + $amount,
    level = floor(sqrt((xp + $amount) / 10.0)) + 1,
    updated_at = now()
WHERE user_id = $userId
RETURNING xp, level;
```

### XP award triggers

| Action | XP | Triggered in |
|--------|-----|--------------|
| Register for event | +10 | manage-events `register` |
| Submit feedback | +5 | manage-feedbacks `create` |
| Complete a todo | +2 | manage-todos `update` (when completed=true) |

### Level progression

| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1 | 0 | 0 |
| 2 | 10 | 10 |
| 3 | 40 | 40 |
| 4 | 90 | 90 |
| 5 | 160 | 160 |

Formula: `level = floor(sqrt(xp / 10)) + 1`, so XP needed for level N = `10 * (N-1)^2`

### Badges

Stored as string array in `user_levels.badges`. Examples:
- `"event_veteran"` — Registered for 10+ events
- `"feedback_champion"` — Submitted 20+ feedbacks
- `"task_master"` — Completed 50+ todos

Badges are granted by admin via `manage-levels` `grant-badge` action. Automatic badge triggers can be added later.

---

## 8. Security Considerations

- **Todo access control:** Personal todos only visible to creator. Public todos visible to all but only editable by creator or assignee.
- **Score integrity:** `game_scores` has no UPDATE/DELETE — scores are permanent. Edge Function only saves if score > existing best.
- **Vote integrity:** `feedback_votes` composite PK prevents duplicate votes. Vote count denormalized for performance, kept in sync by Edge Function toggle logic.
- **XP manipulation:** `user_levels` has no direct UPDATE RLS policy for users. All XP changes go through Edge Functions with service client, preventing users from inflating their own XP.
- **Content lengths:** All user-input text fields have CHECK constraints at database level and validation in Edge Functions.
