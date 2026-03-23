# Sub-project 2 Batch A: User Interface — Core Features Design

## Overview

Implement the core user-facing features: Home Dashboard, Members list with Info Card system, Profile editing with per-field visibility controls, and Announcements. This builds on the MUI + i18n infrastructure from Sub-project 1.

## Scope

| Page | Type | Features |
|------|------|----------|
| Home (`/home`) | Rewrite stub | Welcome message, community stats, latest 3 announcements, quick navigation |
| Members (`/members`) | Rewrite stub | Member grid with search, Info Card dialog, comment wall |
| Profile (`/profile`) | Enhance existing | Add ProfileEditor: bio, skill tags, social links, per-field visibility switches |
| Announcements (`/announcements`) | Rewrite stub | Announcement feed, pinned posts, moderator+ create/edit/delete |

## What's NOT in scope

- Todos, Games, Feedback, Events enhancements (Batch B)
- Admin dashboard features (Sub-project 3)
- Discord bot integration (Sub-project 4)

---

## 1. Database Tables

### `member_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK, FK → auth.users ON DELETE CASCADE) | User ID |
| `bio` | text (default '', CHECK char_length <= 500) | Personal bio |
| `skill_tags` | text[] (default '{}') | Skill tag array (e.g., `['gaming', 'music']`) |
| `social_links` | jsonb (default '{}') | Social links `{ twitter, github, pixiv, youtube, other }` |
| `visibility` | jsonb (default all true) | Per-field visibility `{ bio, email, skill_tags, social_links, avatar, role, join_date }` |
| `created_at` | timestamptz (default now()) | Created |
| `updated_at` | timestamptz (default now()) | Updated |

**Triggers:**
- Auto-create row on `auth.users` INSERT (SECURITY DEFINER trigger) with all defaults
- Auto-update `updated_at` on UPDATE (reuse existing `handle_updated_at` function)
- Backfill: INSERT for existing users who don't have a `member_profiles` row

**RLS Policies:**
- SELECT: Any authenticated user can read all profiles
- INSERT: No direct insert (trigger only, deny by default)
- UPDATE: Only own profile (`user_id = auth.uid()`)
- DELETE: Admin only

**Visibility is a UI-level privacy feature, not a security boundary.** Any authenticated user can technically read all profile fields via the Supabase client. The `get-members` Edge Function applies visibility filtering for the normal user experience, but this does not prevent a technically skilled user from querying the raw table. This is an accepted trade-off — the data (bio, skill tags, social links) is low-sensitivity. If stronger field-level privacy is needed in the future, a SECURITY DEFINER function can replace direct table access.

### `profile_comments`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Comment ID |
| `profile_user_id` | uuid (FK → auth.users ON DELETE CASCADE) | Profile owner |
| `author_id` | uuid (FK → auth.users ON DELETE CASCADE) | Comment author |
| `content` | text NOT NULL (CHECK char_length BETWEEN 1 AND 500) | Comment text |
| `created_at` | timestamptz (default now()) | Created |

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Any authenticated user, WITH CHECK (`author_id = auth.uid()`) — prevents impersonation
- UPDATE: No updates allowed (comments are immutable)
- DELETE: Profile owner (`profile_user_id = auth.uid()`) or admin

**Design decision:** Comment authors cannot delete their own comments — only the profile owner can moderate their own wall. This is intentional to give profile owners full control over what appears on their profile.

### `announcements`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Announcement ID |
| `title` | text NOT NULL (CHECK char_length BETWEEN 1 AND 200) | Title |
| `content` | text NOT NULL (CHECK char_length BETWEEN 1 AND 5000) | Content body |
| `author_id` | uuid (FK → auth.users ON DELETE CASCADE) | Author |
| `source` | text (default 'web') | `'web'` or `'discord'` (reserved for bot sync) |
| `discord_message_id` | text (nullable) | Discord message ID (reserved for bot sync) |
| `pinned` | boolean (default false) | Pinned to top |
| `created_at` | timestamptz (default now()) | Created |
| `updated_at` | timestamptz (default now()) | Updated |

**Triggers:**
- Auto-update `updated_at` on UPDATE

**RLS Policies:**
- SELECT: Any authenticated user
- INSERT: Moderator or admin (`role IN ('moderator', 'admin')`)
- UPDATE: Moderator or admin
- DELETE: Admin only

---

## 2. Edge Functions

All Edge Functions use the shared `_shared/auth.ts` middleware from Sub-project 1.

**Service client pattern:** When an Edge Function needs to access `auth.users` metadata (display names, avatars), it creates a dedicated service client within the function itself (not via `verifyAuth`). This keeps the `verifyAuth` return value safe (user-scoped only) while allowing controlled service-level access where needed.

### `get-members`

- **Minimum role:** member
- **Body:** `{ search?: string, page?: number, pageSize?: number }`
- **Defaults:** page=1, pageSize=50, max pageSize=100
- **Logic:**
  1. Create a service client within the function for `auth.users` metadata access
  2. Query `member_profiles` joined with user metadata
  3. If `search` provided, filter by display name (case-insensitive)
  4. Apply pagination (LIMIT/OFFSET)
  5. For each member, read their `visibility` JSON and strip fields where value is `false`
  6. Return `{ members: [...], total: count, page, pageSize }`

### `manage-profile`

- **Minimum role:** member (self only)
- **Actions:**
  - `get` — Return the authenticated user's full profile including visibility settings (no filtering). Also returns basic auth info (email, display name, avatar, role, join date) so this replaces the existing `get-profile` function for the Profile page.
  - `update` — Update `bio`, `skill_tags`, `social_links`, `visibility` for the authenticated user. Validates: bio max 500 chars, skill_tags max 10 items each max 50 chars, social_links must be object with string values max 200 chars each.

**Relationship with existing `get-profile`:** The existing `get-profile` Edge Function is preserved and continues to work. `manage-profile` `get` is a superset that also returns profile editing fields. The frontend `Profile.jsx` will switch to `manage-profile` `get`. Other code using `get-profile` (if any) is unaffected.

### `profile-comments`

- **Minimum role:** member
- **Actions:**
  - `list` — Get comments for a `profile_user_id`, joined with author display name + avatar (via service client). Ordered by `created_at` ascending. Paginated: `{ page?, pageSize? }`, defaults page=1, pageSize=50.
  - `create` — Create comment on `profile_user_id`. Validates: content 1-500 chars. Sets `author_id` to authenticated user.
  - `delete` — Delete comment by `id`. Only allowed if authenticated user is the profile owner (of the profile where the comment was posted) or admin.

### `manage-announcements`

- **Minimum role:** member (list) / moderator (create, update) / admin (delete)
- **Actions:**
  - `list` — Get announcements ordered by `pinned DESC, created_at DESC`. Join with author name + avatar (via service client). Paginated: `{ page?, pageSize? }`, defaults page=1, pageSize=20. Returns `{ announcements: [...], total }`.
  - `create` — Create with `title` (max 200), `content` (max 5000), `pinned`. Sets `author_id` and `source = 'web'`. Moderator+.
  - `update` — Update `title`, `content`, `pinned` by `id`. Moderator+.
  - `delete` — Delete by `id`. Admin only.

### `get-stats`

- **Minimum role:** member
- **Logic:** Return `{ memberCount, eventCount, announcementCount }`. Uses service client to count `user_roles` rows (more accurate than `auth.users` since it only counts active members with assigned roles), `events` rows, and `announcements` rows.

---

## 3. Frontend Pages

### Home Dashboard (`/home`)

Replaces stub. Content:

1. **Welcome message** — `Typography` h4: "Welcome back, {displayName}" (i18n key `home.welcome`)
2. **Stats row** — 3 `Card` components showing member count, event count, announcement count. Each with a large number + label. Uses i18n keys `home.stats.members`, `home.stats.events`, `home.stats.announcements`. Calls `get-stats` on mount. Shows `Skeleton` while loading, error message on failure.
3. **Latest announcements** — `List` showing latest 3 announcements (title + relative time). "View all" link to `/announcements`. Shows "No announcements yet" if empty.
4. **Quick navigation** — 4 `Card` buttons linking to Members, Events, Games, Feedback. Each with an icon + label.

### Members (`/members`)

Replaces stub. Container `maxWidth="lg"`. Content:

1. **Search bar** — MUI `TextField` with search icon. Debounced 300ms, calls `get-members` with search param.
2. **Member grid** — MUI `Grid` of `MemberCard` components. Each card shows: avatar, name, role `Chip`, bio preview (1 line, truncated), skill tag `Chip` group (max 3 shown + "+N more"). Loading shows skeleton cards, empty shows `members.noResults`.
3. **Member dialog** — Click a card → opens `MemberDialog` (`Dialog` fullWidth maxWidth="sm"):
   - Top: large avatar, name, role, join date
   - Middle: full bio, all skill tags, social link icon buttons (open in new tab)
   - Bottom: comment wall — list of comments + text input to post new comment
   - Profile owner sees delete buttons on comments they received

### Profile (`/profile`)

Enhances existing. Container changed from `maxWidth="sm"` to `maxWidth="md"`. Adds below current content:

1. **ProfileEditor component** in a `Card`:
   - **Bio** — `TextField` multiline, max 500 chars, character counter
   - **Skill tags** — `Autocomplete` with `multiple` + `freeSolo`. Preset options: Gaming, Music Production, Digital Art, Video Editing, Programming, Streaming, Writing, Photography, 3D Modeling, UI/UX Design. Max 10 tags.
   - **Social links** — 5 `TextField` inputs with platform icons: Twitter/X, GitHub, Pixiv, YouTube, Other
   - **Visibility** — Each field has a `Switch` next to its label. Fields: avatar, bio, email, role, join date, skill tags, social links
   - **Save button** — Calls `manage-profile` with action `update`. Shows success/error `Snackbar`.
   - **Loads** on mount via `manage-profile` action `get`

### Announcements (`/announcements`)

Replaces stub. Content:

1. **Announcement list** — Vertical stack of `AnnouncementCard` components. Pinned ones first (with pin icon), then by date descending. Loading shows skeletons, empty shows `announcements.empty`.
2. **AnnouncementCard** — `Card` with: title (h6), content text, author avatar + name, relative time, pin badge if pinned. Moderator+ sees edit/delete `IconButton`.
3. **Create button** — `Fab` bottom-right, only visible to moderator+. Opens `AnnouncementDialog`.
4. **AnnouncementDialog** — `Dialog` with `TextField` for title (max 200) + content (max 5000) + `Switch` for pinned. Used for both create and edit.
5. **Delete confirmation** — `Dialog` confirmation before deleting.

---

## 4. Frontend Components

### New components

| Component | Props | Description |
|-----------|-------|-------------|
| `MemberCard` | `member, onClick` | Grid card: avatar, name, role, bio preview, skill tags |
| `MemberDialog` | `member, open, onClose` | Full info card + comment wall in Dialog |
| `ProfileEditor` | (none, uses auth context) | Bio/skills/links/visibility edit form |
| `AnnouncementCard` | `announcement, onEdit, onDelete, canManage` | Single announcement card |
| `AnnouncementDialog` | `open, onClose, announcement?, onSave` | Create/edit announcement form |

### Modified files

| File | Changes |
|------|---------|
| `src/pages/Home.jsx` | Rewrite from stub to dashboard |
| `src/pages/Members.jsx` | Rewrite from stub to member grid + search |
| `src/pages/Profile.jsx` | Add ProfileEditor, change maxWidth to "md" |
| `src/pages/Announcements.jsx` | Rewrite from stub to announcement feed |
| `src/services/edgeFunctions.js` | Add: getMembers, getOwnProfile, updateProfile, listComments, createComment, deleteComment, listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, getStats |
| `src/i18n/locales/en.json` | Add all new translation keys |
| `src/i18n/locales/ja.json` | Add all new translation keys |
| `src/i18n/locales/zh-CN.json` | Add all new translation keys |
| `src/i18n/locales/zh-TW.json` | Add all new translation keys |

### New files

| File | Description |
|------|-------------|
| `supabase/migrations/003_member_profiles.sql` | member_profiles table + trigger + backfill + RLS |
| `supabase/migrations/004_profile_comments.sql` | profile_comments table + RLS |
| `supabase/migrations/005_announcements.sql` | announcements table + trigger + RLS |
| `supabase/functions/get-members/index.ts` | Member listing with visibility filtering |
| `supabase/functions/manage-profile/index.ts` | Get/update own profile |
| `supabase/functions/profile-comments/index.ts` | List/create/delete comments |
| `supabase/functions/manage-announcements/index.ts` | CRUD announcements |
| `supabase/functions/get-stats/index.ts` | Community statistics |
| `src/components/MemberCard.jsx` | Member grid card |
| `src/components/MemberDialog.jsx` | Member info card + comment wall dialog |
| `src/components/ProfileEditor.jsx` | Profile editing form |
| `src/components/AnnouncementCard.jsx` | Announcement display card |
| `src/components/AnnouncementDialog.jsx` | Create/edit announcement dialog |

---

## 5. New i18n Keys (English)

```
home.welcome: "Welcome back, {{name}}"
home.stats.members: "Members"
home.stats.events: "Events"
home.stats.announcements: "Announcements"
home.statsError: "Failed to load stats"
home.latestAnnouncements: "Latest Announcements"
home.viewAll: "View all"
home.quickNav: "Quick Navigation"
members.title: "Members"
members.search: "Search members..."
members.noResults: "No members found"
members.skillsMore: "+{{count}} more"
members.commentWall: "Comment Wall"
members.writeComment: "Write a comment..."
members.postComment: "Post"
members.deleteComment: "Delete"
members.noComments: "No comments yet"
members.commentDeleted: "Comment deleted"
members.socialLinks: "Social Links"
profile.editCard: "Edit Info Card"
profile.bio: "Bio"
profile.bioPlaceholder: "Tell us about yourself..."
profile.skillTags: "Skill Tags"
profile.socialLinks: "Social Links"
profile.visibility: "Visibility Settings"
profile.visibilityDesc: "Control what others can see on your profile"
profile.save: "Save"
profile.saved: "Profile saved"
profile.saveFailed: "Failed to save profile"
profile.fields.avatar: "Avatar"
profile.fields.bio: "Bio"
profile.fields.email: "Email"
profile.fields.role: "Role"
profile.fields.joinDate: "Join Date"
profile.fields.skillTags: "Skill Tags"
profile.fields.socialLinks: "Social Links"
announcements.title: "Announcements"
announcements.pinned: "Pinned"
announcements.create: "New Announcement"
announcements.edit: "Edit"
announcements.delete: "Delete"
announcements.titleLabel: "Title"
announcements.contentLabel: "Content"
announcements.pinnedLabel: "Pin to top"
announcements.save: "Save"
announcements.created: "Announcement published"
announcements.updated: "Announcement updated"
announcements.deleted: "Announcement deleted"
announcements.empty: "No announcements yet"
announcements.confirmDelete: "Delete this announcement?"
```

All keys will be translated to ja, zh-CN, zh-TW in the locale files.

---

## 6. Skill Tag Presets

Available as preset options in the Autocomplete (users can also type custom tags):

`Gaming`, `Music Production`, `Digital Art`, `Video Editing`, `Programming`, `Streaming`, `Writing`, `Photography`, `3D Modeling`, `UI/UX Design`

Stored as plain strings in the `skill_tags` text array. No separate skill table — YAGNI.

---

## 7. Security Considerations

- **Visibility is UI-level:** Profile visibility settings filter data in the Edge Function but do not prevent direct database access by authenticated users. This is documented and accepted for low-sensitivity data.
- **Comment impersonation prevention:** `profile_comments` INSERT RLS enforces `author_id = auth.uid()`.
- **Content length enforcement:** Both Edge Functions and database CHECK constraints enforce max lengths (bio: 500, comments: 500, announcement title: 200, announcement content: 5000).
- **Service client isolation:** Edge Functions that need `auth.users` metadata create a dedicated service client within the function, separate from the user-scoped client. The `verifyAuth` middleware does not expose the service client.
- **Rate limiting:** Supabase Edge Functions have built-in rate limits. Future consideration: add per-user rate limiting for comment creation if spam becomes an issue.
