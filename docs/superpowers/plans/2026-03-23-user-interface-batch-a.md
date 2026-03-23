# User Interface Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Home Dashboard, Members with Info Cards, Profile editing with visibility controls, and Announcements.

**Architecture:** New Supabase tables (member_profiles, profile_comments, announcements) with RLS. New Edge Functions for each feature. Frontend pages rewritten from stubs using MUI components with i18n.

**Tech Stack:** React 19, MUI v6, Supabase (RLS + Edge Functions), react-i18next, Vite

**Spec:** `docs/superpowers/specs/2026-03-23-user-interface-batch-a-design.md`

---

## Task 1: SQL Migrations

### Step 1.1 — Create `supabase/migrations/003_member_profiles.sql`

- [ ] Create file `supabase/migrations/003_member_profiles.sql`

```sql
-- ============================================
-- 003_member_profiles.sql
-- member_profiles table, triggers, backfill, RLS
-- ============================================

-- 1. Create member_profiles table
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 500),
  skill_tags text[] not null default '{}',
  social_links jsonb not null default '{}',
  visibility jsonb not null default '{"bio": true, "email": true, "skill_tags": true, "social_links": true, "avatar": true, "role": true, "join_date": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Auto-update updated_at trigger (reuses existing handle_updated_at function from 001)
create trigger on_member_profiles_updated
  before update on public.member_profiles
  for each row execute procedure public.handle_updated_at();

-- 3. Auto-create profile on auth.users INSERT
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.member_profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

-- 4. Backfill: create profiles for existing users who don't have one
insert into public.member_profiles (user_id)
select id from auth.users
where id not in (select user_id from public.member_profiles)
on conflict (user_id) do nothing;

-- 5. RLS
alter table public.member_profiles enable row level security;

-- SELECT: any authenticated user can read all profiles
create policy "member_profiles_select_authenticated"
on public.member_profiles for select
to authenticated
using (true);

-- INSERT: deny by default (trigger only)
-- No INSERT policy = denied for authenticated users

-- UPDATE: only own profile
create policy "member_profiles_update_own"
on public.member_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- DELETE: admin only
create policy "member_profiles_delete_admin"
on public.member_profiles for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

### Step 1.2 — Create `supabase/migrations/004_profile_comments.sql`

- [ ] Create file `supabase/migrations/004_profile_comments.sql`

```sql
-- ============================================
-- 004_profile_comments.sql
-- profile_comments table + RLS
-- ============================================

-- 1. Create profile_comments table
create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

-- 2. Index for fast lookups by profile
create index idx_profile_comments_profile_user_id
on public.profile_comments (profile_user_id, created_at asc);

-- 3. RLS
alter table public.profile_comments enable row level security;

-- SELECT: any authenticated user
create policy "profile_comments_select_authenticated"
on public.profile_comments for select
to authenticated
using (true);

-- INSERT: any authenticated user, must be self as author
create policy "profile_comments_insert_authenticated"
on public.profile_comments for insert
to authenticated
with check (author_id = auth.uid());

-- UPDATE: no updates allowed (comments are immutable)
-- No UPDATE policy = denied

-- DELETE: profile owner or admin
create policy "profile_comments_delete_owner_or_admin"
on public.profile_comments for delete
to authenticated
using (
  profile_user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

### Step 1.3 — Create `supabase/migrations/005_announcements.sql`

- [ ] Create file `supabase/migrations/005_announcements.sql`

```sql
-- ============================================
-- 005_announcements.sql
-- announcements table, trigger, RLS
-- ============================================

-- 1. Create announcements table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 5000),
  author_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'web',
  discord_message_id text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Auto-update updated_at trigger (reuses existing handle_updated_at)
create trigger on_announcements_updated
  before update on public.announcements
  for each row execute procedure public.handle_updated_at();

-- 3. Index for listing (pinned first, then by date)
create index idx_announcements_listing
on public.announcements (pinned desc, created_at desc);

-- 4. RLS
alter table public.announcements enable row level security;

-- SELECT: any authenticated user
create policy "announcements_select_authenticated"
on public.announcements for select
to authenticated
using (true);

-- INSERT: moderator or admin
create policy "announcements_insert_moderator"
on public.announcements for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- UPDATE: moderator or admin
create policy "announcements_update_moderator"
on public.announcements for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- DELETE: admin only
create policy "announcements_delete_admin"
on public.announcements for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

### Step 1.4 — Run migrations

- [ ] Run all three SQL files in Supabase SQL Editor in order: 003, 004, 005

---

## Task 2: Edge Functions

### Step 2.1 — Create `supabase/functions/get-members/index.ts`

- [ ] Create file `supabase/functions/get-members/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { search, page = 1, pageSize = 50 } = body

    const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
    const clampedPage = Math.max(1, page)
    const offset = (clampedPage - 1) * clampedPageSize

    // Service client for auth.users metadata
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get all auth users for metadata join
    const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers()
    if (usersError) return errorResponse(usersError.message, 500)

    const userMap = new Map(
      users.map((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string }) => [
        u.id,
        {
          email: u.email,
          display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
          avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
          created_at: u.created_at,
        },
      ]),
    )

    // Get roles
    const { data: roles, error: rolesError } = await serviceClient
      .from('user_roles')
      .select('user_id, role')
    if (rolesError) return errorResponse(rolesError.message, 500)
    const roleMap = new Map(
      (roles ?? []).map((r: { user_id: string; role: string }) => [r.user_id, r.role]),
    )

    // Get member profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('member_profiles')
      .select('*')

    if (profilesError) return errorResponse(profilesError.message, 500)

    // Combine profiles with user metadata
    let members = (profiles ?? []).map((p: Record<string, unknown>) => {
      const userId = p.user_id as string
      const userMeta = userMap.get(userId)
      const visibility = (p.visibility ?? {}) as Record<string, boolean>
      const role = roleMap.get(userId) ?? 'member'

      const member: Record<string, unknown> = {
        user_id: userId,
        display_name: userMeta?.display_name ?? 'User',
        created_at: userMeta?.created_at ?? null,
        role,
      }

      // Apply visibility filtering
      if (visibility.avatar !== false) {
        member.avatar_url = userMeta?.avatar_url ?? null
      }
      if (visibility.bio !== false) {
        member.bio = p.bio
      }
      if (visibility.email !== false) {
        member.email = userMeta?.email ?? null
      }
      if (visibility.skill_tags !== false) {
        member.skill_tags = p.skill_tags
      }
      if (visibility.social_links !== false) {
        member.social_links = p.social_links
      }
      if (visibility.role === false) {
        member.role = undefined
      }
      if (visibility.join_date === false) {
        member.created_at = undefined
      }

      return member
    })

    // Search filter
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.trim().toLowerCase()
      members = members.filter(
        (m: Record<string, unknown>) =>
          ((m.display_name as string) ?? '').toLowerCase().includes(searchLower),
      )
    }

    // Sort by display name
    members.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.display_name as string) ?? '').localeCompare((b.display_name as string) ?? ''),
    )

    const total = members.length
    const paged = members.slice(offset, offset + clampedPageSize)

    return jsonResponse({
      members: paged,
      total,
      page: clampedPage,
      pageSize: clampedPageSize,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.2 — Create `supabase/functions/manage-profile/index.ts`

- [ ] Create file `supabase/functions/manage-profile/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'get') {
      // Get member_profiles row
      const { data: profile, error: profileError } = await supabaseClient
        .from('member_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileError) return errorResponse(profileError.message, 500)

      // Get role info
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role, created_at, updated_at')
        .eq('user_id', user.id)
        .single()

      return jsonResponse({
        id: user.id,
        email: user.email,
        display_name: (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? user.user_metadata?.name ?? 'User') as string,
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        role: roleData?.role ?? role,
        created_at: user.user_metadata?.created_at ?? null,
        role_since: roleData?.updated_at ?? null,
        bio: profile.bio,
        skill_tags: profile.skill_tags,
        social_links: profile.social_links,
        visibility: profile.visibility,
      })
    }

    if (action === 'update') {
      const { bio, skill_tags, social_links, visibility } = body
      const updates: Record<string, unknown> = {}

      // Validate bio
      if (bio !== undefined) {
        if (typeof bio !== 'string' || bio.length > 500) {
          return errorResponse('Bio must be a string with max 500 characters', 400)
        }
        updates.bio = bio
      }

      // Validate skill_tags
      if (skill_tags !== undefined) {
        if (!Array.isArray(skill_tags) || skill_tags.length > 10) {
          return errorResponse('skill_tags must be an array with max 10 items', 400)
        }
        for (const tag of skill_tags) {
          if (typeof tag !== 'string' || tag.length > 50) {
            return errorResponse('Each skill tag must be a string with max 50 characters', 400)
          }
        }
        updates.skill_tags = skill_tags
      }

      // Validate social_links
      if (social_links !== undefined) {
        if (typeof social_links !== 'object' || social_links === null || Array.isArray(social_links)) {
          return errorResponse('social_links must be an object', 400)
        }
        const allowedKeys = ['twitter', 'github', 'pixiv', 'youtube', 'other']
        for (const [key, val] of Object.entries(social_links)) {
          if (!allowedKeys.includes(key)) {
            return errorResponse(`Invalid social_links key: ${key}`, 400)
          }
          if (typeof val !== 'string' || (val as string).length > 200) {
            return errorResponse(`social_links.${key} must be a string with max 200 characters`, 400)
          }
        }
        updates.social_links = social_links
      }

      // Validate visibility
      if (visibility !== undefined) {
        if (typeof visibility !== 'object' || visibility === null || Array.isArray(visibility)) {
          return errorResponse('visibility must be an object', 400)
        }
        const allowedVisKeys = ['bio', 'email', 'skill_tags', 'social_links', 'avatar', 'role', 'join_date']
        for (const [key, val] of Object.entries(visibility)) {
          if (!allowedVisKeys.includes(key)) {
            return errorResponse(`Invalid visibility key: ${key}`, 400)
          }
          if (typeof val !== 'boolean') {
            return errorResponse(`visibility.${key} must be a boolean`, 400)
          }
        }
        updates.visibility = visibility
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      const { data, error } = await supabaseClient
        .from('member_profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: get, update', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.3 — Create `supabase/functions/profile-comments/index.ts`

- [ ] Create file `supabase/functions/profile-comments/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'list') {
      const { profile_user_id, page = 1, pageSize = 50 } = body

      if (!profile_user_id) {
        return errorResponse('Missing profile_user_id', 400)
      }

      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      // Get comments
      const { data: comments, error: commentsError, count } = await supabaseClient
        .from('profile_comments')
        .select('*', { count: 'exact' })
        .eq('profile_user_id', profile_user_id)
        .order('created_at', { ascending: true })
        .range(offset, offset + clampedPageSize - 1)

      if (commentsError) return errorResponse(commentsError.message, 500)

      // Service client for author metadata
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Get unique author IDs
      const authorIds = [...new Set((comments ?? []).map((c: { author_id: string }) => c.author_id))]

      // Get author metadata
      const authorMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (authorIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers()
        if (!usersError && users) {
          for (const u of users) {
            if (authorIds.includes(u.id)) {
              authorMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (comments ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        author_display_name: authorMap.get(c.author_id as string)?.display_name ?? 'User',
        author_avatar_url: authorMap.get(c.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({
        comments: enriched,
        total: count ?? 0,
        page: clampedPage,
        pageSize: clampedPageSize,
      })
    }

    if (action === 'create') {
      const { profile_user_id, content } = body

      if (!profile_user_id) {
        return errorResponse('Missing profile_user_id', 400)
      }
      if (!content || typeof content !== 'string') {
        return errorResponse('Content is required', 400)
      }
      if (content.length < 1 || content.length > 500) {
        return errorResponse('Content must be between 1 and 500 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('profile_comments')
        .insert({
          profile_user_id,
          author_id: user.id,
          content,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'delete') {
      const { id } = body

      if (!id) {
        return errorResponse('Missing comment id', 400)
      }

      // Check if user is the profile owner or admin
      const { data: comment, error: fetchError } = await supabaseClient
        .from('profile_comments')
        .select('profile_user_id')
        .eq('id', id)
        .single()

      if (fetchError) return errorResponse('Comment not found', 404)

      if (comment.profile_user_id !== user.id && role !== 'admin') {
        return errorResponse('Only the profile owner or admin can delete comments', 403)
      }

      const { error } = await supabaseClient
        .from('profile_comments')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.4 — Create `supabase/functions/manage-announcements/index.ts`

- [ ] Create file `supabase/functions/manage-announcements/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'list') {
      const { page = 1, pageSize = 20 } = body

      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      const { data: announcements, error: annError, count } = await supabaseClient
        .from('announcements')
        .select('*', { count: 'exact' })
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (annError) return errorResponse(annError.message, 500)

      // Service client for author metadata
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const authorIds = [...new Set((announcements ?? []).map((a: { author_id: string }) => a.author_id))]
      const authorMap = new Map<string, { display_name: string; avatar_url: string | null }>()

      if (authorIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers()
        if (!usersError && users) {
          for (const u of users) {
            if (authorIds.includes(u.id)) {
              authorMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (announcements ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        author_display_name: authorMap.get(a.author_id as string)?.display_name ?? 'User',
        author_avatar_url: authorMap.get(a.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({
        announcements: enriched,
        total: count ?? 0,
        page: clampedPage,
        pageSize: clampedPageSize,
      })
    }

    if (action === 'create') {
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { title, content, pinned = false } = body

      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }
      if (!content || typeof content !== 'string' || content.length < 1 || content.length > 5000) {
        return errorResponse('Content must be between 1 and 5000 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('announcements')
        .insert({
          title,
          content,
          author_id: user.id,
          source: 'web',
          pinned: !!pinned,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, title, content, pinned } = body

      if (!id) return errorResponse('Missing announcement id', 400)

      const updates: Record<string, unknown> = {}
      if (title !== undefined) {
        if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
          return errorResponse('Title must be between 1 and 200 characters', 400)
        }
        updates.title = title
      }
      if (content !== undefined) {
        if (typeof content !== 'string' || content.length < 1 || content.length > 5000) {
          return errorResponse('Content must be between 1 and 5000 characters', 400)
        }
        updates.content = content
      }
      if (pinned !== undefined) {
        updates.pinned = !!pinned
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      const { data, error } = await supabaseClient
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') {
        return errorResponse('Admin role required', 403)
      }

      const { id } = body

      if (!id) return errorResponse('Missing announcement id', 400)

      const { error } = await supabaseClient
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.5 — Create `supabase/functions/get-stats/index.ts`

- [ ] Create file `supabase/functions/get-stats/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await verifyAuth(req, 'member')

    // Service client for counting across tables
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const [membersResult, eventsResult, announcementsResult] = await Promise.all([
      serviceClient
        .from('user_roles')
        .select('*', { count: 'exact', head: true }),
      serviceClient
        .from('events')
        .select('*', { count: 'exact', head: true }),
      serviceClient
        .from('announcements')
        .select('*', { count: 'exact', head: true }),
    ])

    return jsonResponse({
      memberCount: membersResult.count ?? 0,
      eventCount: eventsResult.count ?? 0,
      announcementCount: announcementsResult.count ?? 0,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

---

## Task 3: Update `src/services/edgeFunctions.js`

- [ ] Update file `src/services/edgeFunctions.js`

**Complete file content:**

```js
import { supabase } from './supabaseClient'

async function invoke(functionName, body = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    // Try to parse error response body for structured errors
    let parsed = null
    if (error.context?.body) {
      try {
        const text = await new Response(error.context.body).text()
        parsed = JSON.parse(text)
      } catch {
        // ignore parse errors
      }
    }

    const message = parsed?.error ?? error.message ?? 'Unknown error'
    const status = error.context?.status ?? 500
    throw { message, status }
  }

  return data
}

export const edgeFunctions = {
  // Events
  getEvents: () => invoke('get-events'),

  createEvent: (event) => invoke('manage-events', {
    action: 'create',
    ...event,
  }),

  updateEvent: (id, updates) => invoke('manage-events', {
    action: 'update',
    id,
    ...updates,
  }),

  deleteEvent: (id) => invoke('manage-events', {
    action: 'delete',
    id,
  }),

  // Profile (legacy — kept for backward compatibility)
  getProfile: () => invoke('get-profile'),

  // Profile (new — full profile with editing fields)
  getOwnProfile: () => invoke('manage-profile', { action: 'get' }),

  updateProfile: ({ bio, skill_tags, social_links, visibility }) =>
    invoke('manage-profile', {
      action: 'update',
      bio,
      skill_tags,
      social_links,
      visibility,
    }),

  // Members
  getMembers: ({ search, page, pageSize } = {}) =>
    invoke('get-members', { search, page, pageSize }),

  // Profile Comments
  listComments: (profile_user_id, { page, pageSize } = {}) =>
    invoke('profile-comments', {
      action: 'list',
      profile_user_id,
      page,
      pageSize,
    }),

  createComment: (profile_user_id, content) =>
    invoke('profile-comments', {
      action: 'create',
      profile_user_id,
      content,
    }),

  deleteComment: (id) =>
    invoke('profile-comments', {
      action: 'delete',
      id,
    }),

  // Announcements
  listAnnouncements: ({ page, pageSize } = {}) =>
    invoke('manage-announcements', {
      action: 'list',
      page,
      pageSize,
    }),

  createAnnouncement: ({ title, content, pinned }) =>
    invoke('manage-announcements', {
      action: 'create',
      title,
      content,
      pinned,
    }),

  updateAnnouncement: (id, { title, content, pinned }) =>
    invoke('manage-announcements', {
      action: 'update',
      id,
      title,
      content,
      pinned,
    }),

  deleteAnnouncement: (id) =>
    invoke('manage-announcements', {
      action: 'delete',
      id,
    }),

  // Stats
  getStats: () => invoke('get-stats'),

  // Admin
  getUsers: () => invoke('manage-users', { action: 'list' }),

  updateUserRole: (userId, role) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
  }),
}
```

---

## Task 4: Frontend Components

### Step 4.1 — Create `src/components/MemberCard.jsx`

- [ ] Create file `src/components/MemberCard.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

export default function MemberCard({ member, onClick }) {
  const { t } = useTranslation()

  const MAX_TAGS = 3
  const tags = member.skill_tags ?? []
  const visibleTags = tags.slice(0, MAX_TAGS)
  const extraCount = tags.length - MAX_TAGS

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ textAlign: 'center', flexGrow: 1 }}>
          <Avatar
            src={member.avatar_url}
            sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5, fontSize: 28 }}
          >
            {(member.display_name || 'U')[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {member.display_name}
          </Typography>
          {member.role && (
            <Chip
              label={t(`profile.roles.${member.role}`)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          )}
          {member.bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.bio}
            </Typography>
          )}
          {visibleTags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              {visibleTags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
              {extraCount > 0 && (
                <Chip
                  label={t('members.skillsMore', { count: extraCount })}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
```

### Step 4.2 — Create `src/components/MemberDialog.jsx`

- [ ] Create file `src/components/MemberDialog.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import XIcon from '@mui/icons-material/X'
import GitHubIcon from '@mui/icons-material/GitHub'
import YouTubeIcon from '@mui/icons-material/YouTube'
import LinkIcon from '@mui/icons-material/Link'
import BrushIcon from '@mui/icons-material/Brush'

const SOCIAL_ICONS = {
  twitter: XIcon,
  github: GitHubIcon,
  youtube: YouTubeIcon,
  pixiv: BrushIcon,
  other: LinkIcon,
}

export default function MemberDialog({ member, open, onClose }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [posting, setPosting] = useState(false)

  const isProfileOwner = user?.id === member?.user_id

  const loadComments = useCallback(async () => {
    if (!member?.user_id) return
    setLoadingComments(true)
    try {
      const result = await edgeFunctions.listComments(member.user_id)
      setComments(result.comments ?? [])
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setLoadingComments(false)
    }
  }, [member?.user_id])

  useEffect(() => {
    if (open && member?.user_id) {
      loadComments()
    }
    if (!open) {
      setComments([])
      setCommentText('')
    }
  }, [open, member?.user_id, loadComments])

  const handlePostComment = async () => {
    if (!commentText.trim() || !member?.user_id) return
    setPosting(true)
    try {
      await edgeFunctions.createComment(member.user_id, commentText.trim())
      setCommentText('')
      await loadComments()
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPosting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await edgeFunctions.deleteComment(commentId)
      await loadComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  if (!member) return null

  const socialLinks = member.social_links ?? {}
  const joinDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
        <Avatar
          src={member.avatar_url}
          sx={{ width: 80, height: 80, mx: 'auto', mb: 1, fontSize: 32 }}
        >
          {(member.display_name || 'U')[0]?.toUpperCase()}
        </Avatar>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {member.display_name}
        </Typography>
        {member.role && (
          <Chip
            label={t(`profile.roles.${member.role}`)}
            size="small"
            color="primary"
            sx={{ mt: 0.5 }}
          />
        )}
        {joinDate && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('profile.joinDate')}: {joinDate}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {/* Bio */}
        {member.bio && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">{member.bio}</Typography>
          </Box>
        )}

        {/* Skill Tags */}
        {(member.skill_tags ?? []).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {t('profile.skillTags')}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {member.skill_tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Stack>
          </Box>
        )}

        {/* Social Links */}
        {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {t('members.socialLinks')}
            </Typography>
            <Stack direction="row" spacing={1}>
              {Object.entries(socialLinks)
                .filter(([, url]) => url)
                .map(([platform, url]) => {
                  const Icon = SOCIAL_ICONS[platform] || LinkIcon
                  return (
                    <IconButton
                      key={platform}
                      size="small"
                      component="a"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon />
                    </IconButton>
                  )
                })}
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Comment Wall */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          {t('members.commentWall')}
        </Typography>

        {loadingComments ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            {t('members.noComments')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {comments.map((comment) => (
              <ListItem
                key={comment.id}
                secondaryAction={
                  isProfileOwner ? (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDeleteComment(comment.id)}
                      title={t('members.deleteComment')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null
                }
                sx={{ px: 0 }}
              >
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar
                    src={comment.author_avatar_url}
                    sx={{ width: 28, height: 28, fontSize: 14 }}
                  >
                    {(comment.author_display_name || 'U')[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={comment.content}
                  secondary={`${comment.author_display_name} — ${new Date(comment.created_at).toLocaleDateString(i18n.language)}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Add Comment */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('members.writeComment')}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            inputProps={{ maxLength: 500 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handlePostComment()
              }
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handlePostComment}
            disabled={!commentText.trim() || posting}
          >
            {t('members.postComment')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 4.3 — Create `src/components/ProfileEditor.jsx`

- [ ] Create file `src/components/ProfileEditor.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import XIcon from '@mui/icons-material/X'
import GitHubIcon from '@mui/icons-material/GitHub'
import YouTubeIcon from '@mui/icons-material/YouTube'
import BrushIcon from '@mui/icons-material/Brush'
import LinkIcon from '@mui/icons-material/Link'
import SaveIcon from '@mui/icons-material/Save'

const SKILL_PRESETS = [
  'Gaming',
  'Music Production',
  'Digital Art',
  'Video Editing',
  'Programming',
  'Streaming',
  'Writing',
  'Photography',
  '3D Modeling',
  'UI/UX Design',
]

const SOCIAL_FIELDS = [
  { key: 'twitter', icon: XIcon, label: 'Twitter / X' },
  { key: 'github', icon: GitHubIcon, label: 'GitHub' },
  { key: 'pixiv', icon: BrushIcon, label: 'Pixiv' },
  { key: 'youtube', icon: YouTubeIcon, label: 'YouTube' },
  { key: 'other', icon: LinkIcon, label: 'Other' },
]

const VISIBILITY_FIELDS = [
  'avatar',
  'bio',
  'email',
  'role',
  'join_date',
  'skill_tags',
  'social_links',
]

export default function ProfileEditor() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [skillTags, setSkillTags] = useState([])
  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    github: '',
    pixiv: '',
    youtube: '',
    other: '',
  })
  const [visibility, setVisibility] = useState({
    bio: true,
    email: true,
    skill_tags: true,
    social_links: true,
    avatar: true,
    role: true,
    join_date: true,
  })
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const data = await edgeFunctions.getOwnProfile()
        setBio(data.bio ?? '')
        setSkillTags(data.skill_tags ?? [])
        setSocialLinks({
          twitter: data.social_links?.twitter ?? '',
          github: data.social_links?.github ?? '',
          pixiv: data.social_links?.pixiv ?? '',
          youtube: data.social_links?.youtube ?? '',
          other: data.social_links?.other ?? '',
        })
        setVisibility({
          bio: data.visibility?.bio ?? true,
          email: data.visibility?.email ?? true,
          skill_tags: data.visibility?.skill_tags ?? true,
          social_links: data.visibility?.social_links ?? true,
          avatar: data.visibility?.avatar ?? true,
          role: data.visibility?.role ?? true,
          join_date: data.visibility?.join_date ?? true,
        })
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Filter out empty social link values
      const filteredLinks = {}
      for (const [key, val] of Object.entries(socialLinks)) {
        if (val.trim()) {
          filteredLinks[key] = val.trim()
        }
      }

      await edgeFunctions.updateProfile({
        bio,
        skill_tags: skillTags,
        social_links: filteredLinks,
        visibility,
      })
      setSnackbar({ open: true, severity: 'success', message: t('profile.saved') })
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSnackbar({ open: true, severity: 'error', message: t('profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const handleSocialChange = (key, value) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  const handleVisibilityChange = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {t('profile.editCard')}
        </Typography>

        {/* Bio */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.bio')}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('profile.bioPlaceholder')}
          inputProps={{ maxLength: 500 }}
          helperText={`${bio.length}/500`}
          sx={{ mb: 2 }}
        />

        {/* Skill Tags */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.skillTags')}
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          options={SKILL_PRESETS}
          value={skillTags}
          onChange={(_, newValue) => {
            if (newValue.length <= 10) {
              setSkillTags(newValue)
            }
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder={t('profile.skillTags')} />
          )}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        {/* Social Links */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {t('profile.socialLinks')}
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {SOCIAL_FIELDS.map(({ key, icon: Icon, label }) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Icon color="action" sx={{ fontSize: 20 }} />
              <TextField
                size="small"
                fullWidth
                label={label}
                value={socialLinks[key]}
                onChange={(e) => handleSocialChange(key, e.target.value)}
                inputProps={{ maxLength: 200 }}
              />
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Visibility */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.visibility')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('profile.visibilityDesc')}
        </Typography>
        <Stack spacing={0}>
          {VISIBILITY_FIELDS.map((field) => {
            const fieldKey = field === 'join_date' ? 'joinDate' : field === 'skill_tags' ? 'skillTags' : field === 'social_links' ? 'socialLinks' : field
            return (
              <FormControlLabel
                key={field}
                control={
                  <Switch
                    checked={visibility[field]}
                    onChange={() => handleVisibilityChange(field)}
                    size="small"
                  />
                }
                label={t(`profile.fields.${fieldKey}`)}
              />
            )
          })}
        </Stack>

        {/* Save */}
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          fullWidth
          sx={{ mt: 3 }}
        >
          {t('profile.save')}
        </Button>
      </CardContent>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  )
}
```

### Step 4.4 — Create `src/components/AnnouncementCard.jsx`

- [ ] Create file `src/components/AnnouncementCard.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PushPinIcon from '@mui/icons-material/PushPin'

export default function AnnouncementCard({ announcement, onEdit, onDelete, canManage }) {
  const { t, i18n } = useTranslation()

  const timeAgo = new Date(announcement.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {announcement.title}
              </Typography>
              {announcement.pinned && (
                <Chip
                  icon={<PushPinIcon sx={{ fontSize: 16 }} />}
                  label={t('announcements.pinned')}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography
              variant="body1"
              sx={{ whiteSpace: 'pre-wrap', mb: 2 }}
            >
              {announcement.content}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar
                src={announcement.author_avatar_url}
                sx={{ width: 24, height: 24, fontSize: 12 }}
              >
                {(announcement.author_display_name || 'U')[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {announcement.author_display_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {timeAgo}
              </Typography>
            </Stack>
          </Box>
          {canManage && (
            <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
              <IconButton size="small" onClick={() => onEdit(announcement)} title={t('announcements.edit')}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(announcement)} title={t('announcements.delete')}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
```

### Step 4.5 — Create `src/components/AnnouncementDialog.jsx`

- [ ] Create file `src/components/AnnouncementDialog.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'

export default function AnnouncementDialog({ open, onClose, announcement, onSave }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = !!announcement

  useEffect(() => {
    if (open) {
      if (announcement) {
        setTitle(announcement.title ?? '')
        setContent(announcement.content ?? '')
        setPinned(announcement.pinned ?? false)
      } else {
        setTitle('')
        setContent('')
        setPinned(false)
      }
    }
  }, [open, announcement])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ title, content, pinned }, announcement?.id)
      onClose()
    } catch (err) {
      console.error('Failed to save announcement:', err)
    } finally {
      setSaving(false)
    }
  }

  const isValid = title.trim().length >= 1 && title.length <= 200 && content.trim().length >= 1 && content.length <= 5000

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEdit ? t('announcements.edit') : t('announcements.create')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label={t('announcements.titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          inputProps={{ maxLength: 200 }}
          helperText={`${title.length}/200`}
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
          label={t('announcements.contentLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          inputProps={{ maxLength: 5000 }}
          helperText={`${content.length}/5000`}
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          control={
            <Switch checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          }
          label={t('announcements.pinnedLabel')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('common.cancel') ?? 'Cancel'}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isValid || saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {t('announcements.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

---

## Task 5: Rewrite Pages

### Step 5.1 — Rewrite `src/pages/Home.jsx`

- [ ] Rewrite file `src/pages/Home.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Button from '@mui/material/Button'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import CampaignIcon from '@mui/icons-material/Campaign'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import FeedbackIcon from '@mui/icons-material/Feedback'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAnn, setLoadingAnn] = useState(true)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || meta.name || 'User'

  useEffect(() => {
    edgeFunctions.getStats()
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => setLoadingStats(false))

    edgeFunctions.listAnnouncements({ page: 1, pageSize: 3 })
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnn(false))
  }, [])

  const statItems = [
    { label: t('home.stats.members'), value: stats?.memberCount, icon: <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
    { label: t('home.stats.events'), value: stats?.eventCount, icon: <EventIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
    { label: t('home.stats.announcements'), value: stats?.announcementCount, icon: <CampaignIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
  ]

  const quickNavItems = [
    { label: t('nav.members'), path: '/members', icon: <PeopleIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.events'), path: '/events', icon: <EventIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.games'), path: '/games', icon: <SportsEsportsIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.feedback'), path: '/feedback', icon: <FeedbackIcon sx={{ fontSize: 36 }} /> },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Welcome */}
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {t('home.welcome', { name: displayName })}
      </Typography>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statItems.map((item) => (
          <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                {item.icon}
                {loadingStats ? (
                  <Skeleton variant="text" width={60} sx={{ mx: 'auto', fontSize: '2rem' }} />
                ) : statsError ? (
                  <Typography color="error" variant="body2">{t('home.statsError')}</Typography>
                ) : (
                  <Typography variant="h3" sx={{ fontWeight: 700, my: 0.5 }}>
                    {item.value ?? 0}
                  </Typography>
                )}
                <Typography color="text.secondary">{item.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Latest Announcements */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('home.latestAnnouncements')}
            </Typography>
            <Button size="small" onClick={() => navigate('/announcements')}>
              {t('home.viewAll')}
            </Button>
          </Box>
          {loadingAnn ? (
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="text" height={40} />)}
            </Stack>
          ) : announcements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('announcements.empty')}
            </Typography>
          ) : (
            <List disablePadding>
              {announcements.map((ann) => (
                <ListItem key={ann.id} disablePadding>
                  <ListItemButton onClick={() => navigate('/announcements')}>
                    <ListItemText
                      primary={ann.title}
                      secondary={new Date(ann.created_at).toLocaleDateString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {t('home.quickNav')}
      </Typography>
      <Grid container spacing={2}>
        {quickNavItems.map((item) => (
          <Grid size={{ xs: 6, sm: 3 }} key={item.path}>
            <Card>
              <CardActionArea onClick={() => navigate(item.path)} sx={{ py: 3, textAlign: 'center' }}>
                {item.icon}
                <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>
                  {item.label}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}
```

### Step 5.2 — Rewrite `src/pages/Members.jsx`

- [ ] Rewrite file `src/pages/Members.jsx`

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import MemberCard from '../components/MemberCard'
import MemberDialog from '../components/MemberDialog'

export default function Members() {
  const { t } = useTranslation()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const debounceRef = useRef(null)

  const loadMembers = useCallback(async (searchTerm) => {
    setLoading(true)
    try {
      const data = await edgeFunctions.getMembers({ search: searchTerm || undefined })
      setMembers(data.members ?? [])
    } catch (err) {
      console.error('Failed to load members:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers('')
  }, [loadMembers])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadMembers(value)
    }, 300)
  }

  const handleCardClick = (member) => {
    setSelectedMember(member)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setSelectedMember(null)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('members.title')}
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        placeholder={t('members.search')}
        value={search}
        onChange={handleSearchChange}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Member Grid */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Skeleton variant="circular" width={64} height={64} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                  <Skeleton variant="text" width="40%" sx={{ mx: 'auto' }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : members.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">{t('members.noResults')}</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {members.map((member) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={member.user_id}>
              <MemberCard member={member} onClick={() => handleCardClick(member)} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Member Dialog */}
      <MemberDialog
        member={selectedMember}
        open={dialogOpen}
        onClose={handleDialogClose}
      />
    </Container>
  )
}
```

### Step 5.3 — Modify `src/pages/Profile.jsx`

- [ ] Modify file `src/pages/Profile.jsx` — change `maxWidth="sm"` to `maxWidth="md"` and add `ProfileEditor` below the existing card

**Complete file content:**

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
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
import ProfileEditor from '../components/ProfileEditor'

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
    <Container maxWidth="md" sx={{ py: 4 }}>
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

      <ProfileEditor />
    </Container>
  )
}
```

### Step 5.4 — Rewrite `src/pages/Announcements.jsx`

- [ ] Rewrite file `src/pages/Announcements.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import AnnouncementCard from '../components/AnnouncementCard'
import AnnouncementDialog from '../components/AnnouncementDialog'

export default function Announcements() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' })

  const canManage = hasRole('moderator')
  const canDelete = hasRole('admin')

  const loadAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const data = await edgeFunctions.listAnnouncements({ pageSize: 50 })
      setAnnouncements(data.announcements ?? [])
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  const handleSave = async (formData, id) => {
    if (id) {
      await edgeFunctions.updateAnnouncement(id, formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.updated') })
    } else {
      await edgeFunctions.createAnnouncement(formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.created') })
    }
    await loadAnnouncements()
  }

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingAnnouncement(null)
    setDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await edgeFunctions.deleteAnnouncement(deleteTarget.id)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.deleted') })
      setDeleteTarget(null)
      await loadAnnouncements()
    } catch (err) {
      console.error('Failed to delete announcement:', err)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('announcements.title')}
      </Typography>

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : announcements.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">{t('announcements.empty')}</Typography>
        </Box>
      ) : (
        <Stack spacing={0}>
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
              canManage={canManage}
            />
          ))}
        </Stack>
      )}

      {/* Create FAB — moderator+ */}
      {canManage && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={handleCreate}
          title={t('announcements.create')}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create/Edit Dialog */}
      <AnnouncementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        announcement={editingAnnouncement}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('announcements.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('announcements.confirmDelete')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel') ?? 'Cancel'}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {t('announcements.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}
```

---

## Task 6: Update i18n Locale Files

### Step 6.1 — Update `src/i18n/locales/en.json`

- [ ] Merge new keys into `src/i18n/locales/en.json` (keep all existing keys)

**New keys to add:**

```json
{
  "common.cancel": "Cancel",
  "home.welcome": "Welcome back, {{name}}",
  "home.stats.members": "Members",
  "home.stats.events": "Events",
  "home.stats.announcements": "Announcements",
  "home.statsError": "Failed to load stats",
  "home.latestAnnouncements": "Latest Announcements",
  "home.viewAll": "View all",
  "home.quickNav": "Quick Navigation",
  "members.title": "Members",
  "members.search": "Search members...",
  "members.noResults": "No members found",
  "members.skillsMore": "+{{count}} more",
  "members.commentWall": "Comment Wall",
  "members.writeComment": "Write a comment...",
  "members.postComment": "Post",
  "members.deleteComment": "Delete",
  "members.noComments": "No comments yet",
  "members.commentDeleted": "Comment deleted",
  "members.socialLinks": "Social Links",
  "profile.editCard": "Edit Info Card",
  "profile.bio": "Bio",
  "profile.bioPlaceholder": "Tell us about yourself...",
  "profile.skillTags": "Skill Tags",
  "profile.socialLinks": "Social Links",
  "profile.visibility": "Visibility Settings",
  "profile.visibilityDesc": "Control what others can see on your profile",
  "profile.save": "Save",
  "profile.saved": "Profile saved",
  "profile.saveFailed": "Failed to save profile",
  "profile.fields.avatar": "Avatar",
  "profile.fields.bio": "Bio",
  "profile.fields.email": "Email",
  "profile.fields.role": "Role",
  "profile.fields.joinDate": "Join Date",
  "profile.fields.skillTags": "Skill Tags",
  "profile.fields.socialLinks": "Social Links",
  "announcements.title": "Announcements",
  "announcements.pinned": "Pinned",
  "announcements.create": "New Announcement",
  "announcements.edit": "Edit",
  "announcements.delete": "Delete",
  "announcements.titleLabel": "Title",
  "announcements.contentLabel": "Content",
  "announcements.pinnedLabel": "Pin to top",
  "announcements.save": "Save",
  "announcements.created": "Announcement published",
  "announcements.updated": "Announcement updated",
  "announcements.deleted": "Announcement deleted",
  "announcements.empty": "No announcements yet",
  "announcements.confirmDelete": "Delete this announcement?"
}
```

### Step 6.2 — Update `src/i18n/locales/ja.json`

- [ ] Merge new keys into `src/i18n/locales/ja.json`

**New keys to add:**

```json
{
  "common.cancel": "キャンセル",
  "home.welcome": "おかえりなさい、{{name}}",
  "home.stats.members": "メンバー",
  "home.stats.events": "イベント",
  "home.stats.announcements": "お知らせ",
  "home.statsError": "統計の読み込みに失敗しました",
  "home.latestAnnouncements": "最新のお知らせ",
  "home.viewAll": "すべて見る",
  "home.quickNav": "クイックナビゲーション",
  "members.title": "メンバー",
  "members.search": "メンバーを検索...",
  "members.noResults": "メンバーが見つかりません",
  "members.skillsMore": "+{{count}}件",
  "members.commentWall": "コメントウォール",
  "members.writeComment": "コメントを書く...",
  "members.postComment": "投稿",
  "members.deleteComment": "削除",
  "members.noComments": "コメントはまだありません",
  "members.commentDeleted": "コメントを削除しました",
  "members.socialLinks": "ソーシャルリンク",
  "profile.editCard": "プロフィールカード編集",
  "profile.bio": "自己紹介",
  "profile.bioPlaceholder": "自己紹介を書いてみましょう...",
  "profile.skillTags": "スキルタグ",
  "profile.socialLinks": "ソーシャルリンク",
  "profile.visibility": "公開設定",
  "profile.visibilityDesc": "プロフィールに表示する項目を管理",
  "profile.save": "保存",
  "profile.saved": "プロフィールを保存しました",
  "profile.saveFailed": "プロフィールの保存に失敗しました",
  "profile.fields.avatar": "アバター",
  "profile.fields.bio": "自己紹介",
  "profile.fields.email": "メール",
  "profile.fields.role": "ロール",
  "profile.fields.joinDate": "参加日",
  "profile.fields.skillTags": "スキルタグ",
  "profile.fields.socialLinks": "ソーシャルリンク",
  "announcements.title": "お知らせ",
  "announcements.pinned": "固定",
  "announcements.create": "新しいお知らせ",
  "announcements.edit": "編集",
  "announcements.delete": "削除",
  "announcements.titleLabel": "タイトル",
  "announcements.contentLabel": "内容",
  "announcements.pinnedLabel": "上部に固定",
  "announcements.save": "保存",
  "announcements.created": "お知らせを公開しました",
  "announcements.updated": "お知らせを更新しました",
  "announcements.deleted": "お知らせを削除しました",
  "announcements.empty": "お知らせはまだありません",
  "announcements.confirmDelete": "このお知らせを削除しますか？"
}
```

### Step 6.3 — Update `src/i18n/locales/zh-CN.json`

- [ ] Merge new keys into `src/i18n/locales/zh-CN.json`

**New keys to add:**

```json
{
  "common.cancel": "取消",
  "home.welcome": "欢迎回来，{{name}}",
  "home.stats.members": "成员",
  "home.stats.events": "活动",
  "home.stats.announcements": "公告",
  "home.statsError": "统计数据加载失败",
  "home.latestAnnouncements": "最新公告",
  "home.viewAll": "查看全部",
  "home.quickNav": "快速导航",
  "members.title": "成员",
  "members.search": "搜索成员...",
  "members.noResults": "未找到成员",
  "members.skillsMore": "+{{count}}项",
  "members.commentWall": "留言墙",
  "members.writeComment": "写一条留言...",
  "members.postComment": "发布",
  "members.deleteComment": "删除",
  "members.noComments": "暂无留言",
  "members.commentDeleted": "留言已删除",
  "members.socialLinks": "社交链接",
  "profile.editCard": "编辑资料卡",
  "profile.bio": "个人简介",
  "profile.bioPlaceholder": "介绍一下自己吧...",
  "profile.skillTags": "技能标签",
  "profile.socialLinks": "社交链接",
  "profile.visibility": "可见性设置",
  "profile.visibilityDesc": "控制其他人可以看到你资料中的哪些内容",
  "profile.save": "保存",
  "profile.saved": "资料已保存",
  "profile.saveFailed": "资料保存失败",
  "profile.fields.avatar": "头像",
  "profile.fields.bio": "个人简介",
  "profile.fields.email": "邮箱",
  "profile.fields.role": "角色",
  "profile.fields.joinDate": "加入日期",
  "profile.fields.skillTags": "技能标签",
  "profile.fields.socialLinks": "社交链接",
  "announcements.title": "公告",
  "announcements.pinned": "已置顶",
  "announcements.create": "发布公告",
  "announcements.edit": "编辑",
  "announcements.delete": "删除",
  "announcements.titleLabel": "标题",
  "announcements.contentLabel": "内容",
  "announcements.pinnedLabel": "置顶",
  "announcements.save": "保存",
  "announcements.created": "公告已发布",
  "announcements.updated": "公告已更新",
  "announcements.deleted": "公告已删除",
  "announcements.empty": "暂无公告",
  "announcements.confirmDelete": "确定删除这条公告吗？"
}
```

### Step 6.4 — Update `src/i18n/locales/zh-TW.json`

- [ ] Merge new keys into `src/i18n/locales/zh-TW.json`

**New keys to add:**

```json
{
  "common.cancel": "取消",
  "home.welcome": "歡迎回來，{{name}}",
  "home.stats.members": "成員",
  "home.stats.events": "活動",
  "home.stats.announcements": "公告",
  "home.statsError": "統計數據載入失敗",
  "home.latestAnnouncements": "最新公告",
  "home.viewAll": "查看全部",
  "home.quickNav": "快速導航",
  "members.title": "成員",
  "members.search": "搜尋成員...",
  "members.noResults": "找不到成員",
  "members.skillsMore": "+{{count}}項",
  "members.commentWall": "留言牆",
  "members.writeComment": "寫一則留言...",
  "members.postComment": "發布",
  "members.deleteComment": "刪除",
  "members.noComments": "目前沒有留言",
  "members.commentDeleted": "留言已刪除",
  "members.socialLinks": "社群連結",
  "profile.editCard": "編輯個人資訊卡",
  "profile.bio": "個人簡介",
  "profile.bioPlaceholder": "介紹一下自己吧...",
  "profile.skillTags": "技能標籤",
  "profile.socialLinks": "社群連結",
  "profile.visibility": "可見性設定",
  "profile.visibilityDesc": "控制其他人可以看到你檔案中的哪些內容",
  "profile.save": "儲存",
  "profile.saved": "個人檔案已儲存",
  "profile.saveFailed": "個人檔案儲存失敗",
  "profile.fields.avatar": "頭像",
  "profile.fields.bio": "個人簡介",
  "profile.fields.email": "Email",
  "profile.fields.role": "角色",
  "profile.fields.joinDate": "加入日期",
  "profile.fields.skillTags": "技能標籤",
  "profile.fields.socialLinks": "社群連結",
  "announcements.title": "公告",
  "announcements.pinned": "已置頂",
  "announcements.create": "發布公告",
  "announcements.edit": "編輯",
  "announcements.delete": "刪除",
  "announcements.titleLabel": "標題",
  "announcements.contentLabel": "內容",
  "announcements.pinnedLabel": "置頂",
  "announcements.save": "儲存",
  "announcements.created": "公告已發布",
  "announcements.updated": "公告已更新",
  "announcements.deleted": "公告已刪除",
  "announcements.empty": "目前沒有公告",
  "announcements.confirmDelete": "確定刪除這則公告嗎？"
}
```

---

## Task 7: Build Verification & Deploy

### Step 7.1 — Build check

- [ ] Run `npm run build` to verify no compilation errors

### Step 7.2 — Deploy Edge Functions

- [ ] `supabase functions deploy get-members`
- [ ] `supabase functions deploy manage-profile`
- [ ] `supabase functions deploy profile-comments`
- [ ] `supabase functions deploy manage-announcements`
- [ ] `supabase functions deploy get-stats`

### Step 7.3 — Run SQL migrations

- [ ] Run `003_member_profiles.sql` in Supabase SQL Editor
- [ ] Run `004_profile_comments.sql` in Supabase SQL Editor
- [ ] Run `005_announcements.sql` in Supabase SQL Editor

### Step 7.4 — Final commit & push

- [ ] `git add -A && git commit -m "feat: implement User Interface Batch A — Home Dashboard, Members, Profile Editor, Announcements" && git push`

---

## File Summary

### New files (13)

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

### Modified files (6)

| File | Changes |
|------|---------|
| `src/services/edgeFunctions.js` | Add 11 new API functions |
| `src/pages/Home.jsx` | Rewrite from stub to dashboard |
| `src/pages/Members.jsx` | Rewrite from stub to member grid + search |
| `src/pages/Profile.jsx` | Change maxWidth to "md", add ProfileEditor |
| `src/pages/Announcements.jsx` | Rewrite from stub to announcement feed |
| `src/i18n/locales/{en,ja,zh-CN,zh-TW}.json` | Add all new translation keys |
