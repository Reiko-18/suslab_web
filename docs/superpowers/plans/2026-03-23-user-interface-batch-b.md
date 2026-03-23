# User Interface Batch B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Todos (personal+community), 2048 game with leaderboard, game invites, feedback with voting, event registration, and XP/level/badge system.

**Architecture:** New Supabase tables with RLS for todos, games, feedback, event registrations, and user levels. Shared XP helper for atomic level progression. 2048 game is pure frontend with score submission. Edge Functions handle all data operations with role-based access.

**Tech Stack:** React 19, MUI v6, Supabase (RLS + Edge Functions), react-i18next, Vite

**Spec:** `docs/superpowers/specs/2026-03-23-user-interface-batch-b-design.md`

---

## Task 1: SQL Migrations (006-010)

### Step 1.1 — Create `supabase/migrations/006_todos.sql`

- [ ] Create file `supabase/migrations/006_todos.sql`

```sql
-- ============================================
-- 006_todos.sql
-- todos table, triggers, RLS
-- ============================================

-- 1. Create todos table
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  completed boolean not null default false,
  is_public boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Auto-update updated_at trigger (reuses existing handle_updated_at function from 001)
create trigger on_todos_updated
  before update on public.todos
  for each row execute procedure public.handle_updated_at();

-- 3. RLS
alter table public.todos enable row level security;

-- SELECT: Own todos OR public todos
create policy "todos_select_own_or_public"
on public.todos for select
to authenticated
using (
  user_id = auth.uid() or is_public = true
);

-- INSERT: Any authenticated user, must be own user_id
create policy "todos_insert_own"
on public.todos for insert
to authenticated
with check (user_id = auth.uid());

-- UPDATE: Creator or assignee
create policy "todos_update_creator_or_assignee"
on public.todos for update
to authenticated
using (
  user_id = auth.uid() or assigned_to = auth.uid()
)
with check (
  user_id = auth.uid() or assigned_to = auth.uid()
);

-- DELETE: Creator only
create policy "todos_delete_creator"
on public.todos for delete
to authenticated
using (user_id = auth.uid());
```

### Step 1.2 — Create `supabase/migrations/007_games.sql`

- [ ] Create file `supabase/migrations/007_games.sql`

```sql
-- ============================================
-- 007_games.sql
-- game_invites, game_invite_participants, game_scores tables + RLS
-- ============================================

-- 1. game_invites table
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  game_type text not null,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 500),
  max_players integer not null default 4 check (max_players > 0),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.game_invites enable row level security;

-- SELECT: Any authenticated user
create policy "game_invites_select_authenticated"
on public.game_invites for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own host_id
create policy "game_invites_insert_own"
on public.game_invites for insert
to authenticated
with check (host_id = auth.uid());

-- UPDATE: Host only
create policy "game_invites_update_host"
on public.game_invites for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

-- DELETE: Host or admin
create policy "game_invites_delete_host_or_admin"
on public.game_invites for delete
to authenticated
using (
  host_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 2. game_invite_participants table
create table if not exists public.game_invite_participants (
  invite_id uuid not null references public.game_invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

alter table public.game_invite_participants enable row level security;

-- SELECT: Any authenticated user
create policy "game_invite_participants_select_authenticated"
on public.game_invite_participants for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own user_id
create policy "game_invite_participants_insert_own"
on public.game_invite_participants for insert
to authenticated
with check (user_id = auth.uid());

-- DELETE: Own participation only
create policy "game_invite_participants_delete_own"
on public.game_invite_participants for delete
to authenticated
using (user_id = auth.uid());

-- 3. game_scores table
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_type text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

alter table public.game_scores enable row level security;

-- SELECT: Any authenticated user
create policy "game_scores_select_authenticated"
on public.game_scores for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own user_id
create policy "game_scores_insert_own"
on public.game_scores for insert
to authenticated
with check (user_id = auth.uid());

-- No UPDATE or DELETE policies (scores are permanent)
```

### Step 1.3 — Create `supabase/migrations/008_feedbacks.sql`

- [ ] Create file `supabase/migrations/008_feedbacks.sql`

```sql
-- ============================================
-- 008_feedbacks.sql
-- feedbacks + feedback_votes tables + RLS
-- ============================================

-- 1. feedbacks table
create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('feature', 'event', 'bug')),
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'accepted', 'rejected')),
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

-- SELECT: Any authenticated user
create policy "feedbacks_select_authenticated"
on public.feedbacks for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own author_id
create policy "feedbacks_insert_own"
on public.feedbacks for insert
to authenticated
with check (author_id = auth.uid());

-- UPDATE: Moderator+ (RLS grants row UPDATE; Edge Function restricts to status-only)
create policy "feedbacks_update_moderator"
on public.feedbacks for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- DELETE: Author or admin
create policy "feedbacks_delete_author_or_admin"
on public.feedbacks for delete
to authenticated
using (
  author_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 2. feedback_votes table
create table if not exists public.feedback_votes (
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (feedback_id, user_id)
);

alter table public.feedback_votes enable row level security;

-- SELECT: Any authenticated user
create policy "feedback_votes_select_authenticated"
on public.feedback_votes for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own user_id
create policy "feedback_votes_insert_own"
on public.feedback_votes for insert
to authenticated
with check (user_id = auth.uid());

-- DELETE: Own vote only
create policy "feedback_votes_delete_own"
on public.feedback_votes for delete
to authenticated
using (user_id = auth.uid());
```

### Step 1.4 — Create `supabase/migrations/009_event_registrations.sql`

- [ ] Create file `supabase/migrations/009_event_registrations.sql`

```sql
-- ============================================
-- 009_event_registrations.sql
-- event_registrations table + RLS
-- ============================================

create table if not exists public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  registered_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_registrations enable row level security;

-- SELECT: Any authenticated user
create policy "event_registrations_select_authenticated"
on public.event_registrations for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own user_id
create policy "event_registrations_insert_own"
on public.event_registrations for insert
to authenticated
with check (user_id = auth.uid());

-- DELETE: Own registration or admin
create policy "event_registrations_delete_own_or_admin"
on public.event_registrations for delete
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

### Step 1.5 — Create `supabase/migrations/010_user_levels.sql`

- [ ] Create file `supabase/migrations/010_user_levels.sql`

```sql
-- ============================================
-- 010_user_levels.sql
-- user_levels table, auto-create trigger, backfill, RLS
-- ============================================

-- 1. Create user_levels table
create table if not exists public.user_levels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  badges text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 2. Auto-update updated_at trigger
create trigger on_user_levels_updated
  before update on public.user_levels
  for each row execute procedure public.handle_updated_at();

-- 3. Auto-create user_levels row on auth.users INSERT
create or replace function public.handle_new_user_levels()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_levels (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_levels
  after insert on auth.users
  for each row execute procedure public.handle_new_user_levels();

-- 4. Backfill: create user_levels rows for existing users who don't have one
insert into public.user_levels (user_id)
select id from auth.users
where id not in (select user_id from public.user_levels)
on conflict (user_id) do nothing;

-- 5. RLS
alter table public.user_levels enable row level security;

-- SELECT: Any authenticated user
create policy "user_levels_select_authenticated"
on public.user_levels for select
to authenticated
using (true);

-- No INSERT policy (trigger only)
-- No UPDATE policy for users (Edge Functions use service client)
```

---

## Task 2: Shared XP Helper + Edge Functions

### Step 2.1 — Create `supabase/functions/_shared/xp.ts`

- [ ] Create file `supabase/functions/_shared/xp.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Atomically add XP to a user and recalculate their level.
 * Uses a single UPDATE statement to prevent race conditions.
 * Must be called with a service-role client (bypasses RLS).
 */
export async function addXp(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number } | null> {
  const { data, error } = await serviceClient.rpc('add_user_xp', {
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) {
    // Fallback: use raw SQL via service client if RPC not available
    // This uses a single atomic UPDATE — no SELECT then UPDATE
    const { data: updated, error: updateError } = await serviceClient
      .from('user_levels')
      .update({
        xp: undefined, // placeholder — we use raw SQL below
      })
      .eq('user_id', userId)
      .select()
      .single()

    // If the above doesn't work either, use the SQL approach directly
    // The RPC approach is preferred, so let's define it as a migration-free approach:
    // We execute raw SQL through the service client's rpc
    console.error('addXp rpc fallback error:', error.message)
    return null
  }

  return data
}

/**
 * Atomically add XP using a direct SQL statement via service client.
 * This is the primary implementation — uses a single atomic UPDATE.
 */
export async function addXpDirect(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number } | null> {
  // Use a single atomic SQL statement to prevent race conditions.
  // We update xp and level in one statement — no SELECT-then-UPDATE.
  const { data, error } = await serviceClient
    .rpc('exec_sql', {
      query: `
        UPDATE public.user_levels
        SET xp = xp + $1,
            level = floor(sqrt((xp + $1) / 10.0))::int + 1,
            updated_at = now()
        WHERE user_id = $2
        RETURNING xp, level
      `,
      params: [amount, userId],
    })

  if (error) {
    console.error('addXpDirect error:', error.message)
    return null
  }

  return data?.[0] ?? null
}
```

**IMPORTANT:** The above approach requires either an `exec_sql` RPC or direct PostgREST support. Since Supabase Edge Functions have access to the service role key, the simpler and more reliable approach is to use the Supabase client's built-in capabilities. Here is the **actual implementation** to use:

- [ ] Replace the file content with the following proven approach:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Atomically add XP to a user and recalculate their level.
 * Uses a single UPDATE statement via PostgREST raw filter to prevent race conditions.
 * Must be called with a service-role client (bypasses RLS).
 *
 * The SQL executed is equivalent to:
 *   UPDATE user_levels
 *   SET xp = xp + $amount,
 *       level = floor(sqrt((xp + $amount) / 10.0)) + 1,
 *       updated_at = now()
 *   WHERE user_id = $userId
 *   RETURNING xp, level;
 */
export async function addXp(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number } | null> {
  // Step 1: Fetch current XP in the same transaction context
  // Step 2: Compute new values and update atomically
  // NOTE: PostgREST doesn't support xp = xp + N natively.
  // To ensure atomicity, we use a Postgres function created at deploy time,
  // OR we use a single fetch-and-update with optimistic locking.
  //
  // Best approach for Supabase: use .rpc() with a custom function.
  // Since we cannot add a migration here, we use the service client
  // to execute a raw SQL query via the pg_net or REST endpoint.
  //
  // ACTUAL ATOMIC APPROACH: Use Supabase's built-in SQL execution
  // via the service client connecting directly.

  // Use fetch to call the Supabase REST API with a raw PostgreSQL function call
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/add_xp_atomic`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_amount: amount,
      }),
    },
  )

  if (!response.ok) {
    const errText = await response.text()
    console.error('addXp error:', errText)
    return null
  }

  const result = await response.json()
  return result
}
```

**WAIT — this requires a database function.** Let us add that to the migration 010 and simplify the helper. Here is the final, correct approach:

- [ ] **FINAL** `supabase/functions/_shared/xp.ts` — uses an RPC function defined in migration 010:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Atomically add XP to a user and recalculate their level.
 * Calls the `add_xp_atomic` Postgres function (defined in 010_user_levels.sql).
 * Uses a single atomic UPDATE — no SELECT then UPDATE.
 * Must be called with a service-role client (bypasses RLS).
 */
export async function addXp(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number } | null> {
  const { data, error } = await serviceClient.rpc('add_xp_atomic', {
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) {
    console.error('addXp error:', error.message)
    return null
  }

  return data
}
```

- [ ] **Update** `supabase/migrations/010_user_levels.sql` to include the atomic XP function. Append after the RLS section:

```sql
-- 6. Atomic XP add function (called by Edge Functions via service client)
create or replace function public.add_xp_atomic(p_user_id uuid, p_amount integer)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  result record;
begin
  update public.user_levels
  set xp = xp + p_amount,
      level = floor(sqrt((xp + p_amount) / 10.0))::int + 1,
      updated_at = now()
  where user_id = p_user_id
  returning xp, level into result;

  return json_build_object('xp', result.xp, 'level', result.level);
end;
$$;
```

### Step 2.2 — Create `supabase/functions/manage-todos/index.ts`

- [ ] Create file `supabase/functions/manage-todos/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    // Service client for XP operations and user metadata
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'list') {
      const { page = 1, pageSize = 50 } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      // RLS handles visibility: own todos + public todos
      const { data: todos, error, count } = await supabaseClient
        .from('todos')
        .select('*', { count: 'exact' })
        .order('completed', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (error) return errorResponse(error.message, 500)

      // Enrich with user display names
      const userIds = [...new Set(
        (todos ?? []).flatMap((t: Record<string, unknown>) =>
          [t.user_id, t.assigned_to].filter(Boolean) as string[]
        )
      )]

      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (userIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (todos ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        creator_display_name: userMap.get(t.user_id as string)?.display_name ?? 'User',
        creator_avatar_url: userMap.get(t.user_id as string)?.avatar_url ?? null,
        assignee_display_name: t.assigned_to ? (userMap.get(t.assigned_to as string)?.display_name ?? null) : null,
        assignee_avatar_url: t.assigned_to ? (userMap.get(t.assigned_to as string)?.avatar_url ?? null) : null,
      }))

      return jsonResponse({ todos: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create') {
      const { title, is_public = false } = body

      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('todos')
        .insert({ user_id: user.id, title, is_public: !!is_public })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const { id, title, completed } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo first to determine permissions
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)

      // Build update object based on user role relative to this todo
      const updates: Record<string, unknown> = {}

      if (todo.user_id === user.id) {
        // Creator can update title and completed
        if (title !== undefined) {
          if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
            return errorResponse('Title must be between 1 and 200 characters', 400)
          }
          updates.title = title
        }
        if (completed !== undefined) updates.completed = !!completed
      } else if (todo.assigned_to === user.id) {
        // Assignee can ONLY change completed
        if (completed !== undefined) updates.completed = !!completed
        // Ignore any other fields — assignees cannot change title etc.
      } else {
        return errorResponse('Not authorized to update this todo', 403)
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      const { data, error } = await supabaseClient
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Award XP when completing a todo (only when transitioning to completed)
      if (completed === true && !todo.completed) {
        await addXp(serviceClient, user.id, 2)
      }

      return jsonResponse(data)
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // RLS ensures only creator can delete
      const { error } = await supabaseClient
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'claim') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo to check it's public and unclaimed
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)
      if (!todo.is_public) return errorResponse('Can only claim public todos', 400)
      if (todo.assigned_to) return errorResponse('Todo is already claimed', 400)

      // Use service client to update assigned_to (bypasses RLS check for this edge case)
      const { data, error } = await serviceClient
        .from('todos')
        .update({ assigned_to: user.id })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'unclaim') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo to verify the current user is the assignee
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)
      if (todo.assigned_to !== user.id) return errorResponse('You are not the assignee', 403)

      const { data, error } = await serviceClient
        .from('todos')
        .update({ assigned_to: null })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: list, create, update, delete, claim, unclaim', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.3 — Create `supabase/functions/manage-games/index.ts`

- [ ] Create file `supabase/functions/manage-games/index.ts`

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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'list-invites') {
      const { page = 1, pageSize = 20 } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      const { data: invites, error, count } = await supabaseClient
        .from('game_invites')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (error) return errorResponse(error.message, 500)

      // Get participant counts and host info
      const inviteIds = (invites ?? []).map((i: Record<string, unknown>) => i.id as string)
      const hostIds = [...new Set((invites ?? []).map((i: Record<string, unknown>) => i.host_id as string))]

      // Participants
      let participantCounts = new Map<string, number>()
      let participantUsers = new Map<string, string[]>()
      if (inviteIds.length > 0) {
        const { data: participants } = await supabaseClient
          .from('game_invite_participants')
          .select('invite_id, user_id')
          .in('invite_id', inviteIds)

        if (participants) {
          for (const p of participants) {
            const current = participantCounts.get(p.invite_id) ?? 0
            participantCounts.set(p.invite_id, current + 1)
            const users = participantUsers.get(p.invite_id) ?? []
            users.push(p.user_id)
            participantUsers.set(p.invite_id, users)
          }
        }
      }

      // Host display names
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (hostIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (hostIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (invites ?? []).map((i: Record<string, unknown>) => ({
        ...i,
        host_display_name: userMap.get(i.host_id as string)?.display_name ?? 'User',
        host_avatar_url: userMap.get(i.host_id as string)?.avatar_url ?? null,
        participant_count: participantCounts.get(i.id as string) ?? 0,
        is_participant: (participantUsers.get(i.id as string) ?? []).includes(user.id),
      }))

      return jsonResponse({ invites: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create-invite') {
      const { game_type, title, description, max_players = 4 } = body

      if (!game_type || typeof game_type !== 'string') {
        return errorResponse('game_type is required', 400)
      }
      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 100) {
        return errorResponse('Title must be between 1 and 100 characters', 400)
      }
      if (description && (typeof description !== 'string' || description.length > 500)) {
        return errorResponse('Description must be 500 characters or less', 400)
      }
      if (typeof max_players !== 'number' || max_players < 1) {
        return errorResponse('max_players must be a positive number', 400)
      }

      const { data, error } = await supabaseClient
        .from('game_invites')
        .insert({
          host_id: user.id,
          game_type,
          title,
          description: description ?? null,
          max_players,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'join-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // Check invite exists, is open, and not full
      const { data: invite, error: fetchError } = await supabaseClient
        .from('game_invites')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !invite) return errorResponse('Invite not found', 404)
      if (invite.status !== 'open') return errorResponse('Invite is not open', 400)

      // Check participant count
      const { count } = await supabaseClient
        .from('game_invite_participants')
        .select('*', { count: 'exact', head: true })
        .eq('invite_id', id)

      if ((count ?? 0) >= invite.max_players) {
        return errorResponse('Invite is full', 400)
      }

      const { data, error } = await supabaseClient
        .from('game_invite_participants')
        .insert({ invite_id: id, user_id: user.id })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') return errorResponse('Already joined this invite', 400)
        return errorResponse(error.message, 500)
      }
      return jsonResponse(data, 201)
    }

    if (action === 'leave-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // RLS ensures only own participation can be deleted
      const { error } = await supabaseClient
        .from('game_invite_participants')
        .delete()
        .eq('invite_id', id)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'close-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // RLS ensures only host can update
      const { data, error } = await supabaseClient
        .from('game_invites')
        .update({ status: 'closed' })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'submit-score') {
      const { score } = body
      if (typeof score !== 'number' || score < 0) {
        return errorResponse('Score must be a non-negative number', 400)
      }

      // Check if user already has a higher score
      const { data: existing } = await supabaseClient
        .from('game_scores')
        .select('score')
        .eq('user_id', user.id)
        .eq('game_type', '2048')
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing && existing.score >= score) {
        return jsonResponse({ saved: false, message: 'Score not higher than existing best', best: existing.score })
      }

      const { data, error } = await supabaseClient
        .from('game_scores')
        .insert({ user_id: user.id, game_type: '2048', score })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ saved: true, score: data.score })
    }

    if (action === 'leaderboard') {
      // Top 20 scores for 2048 — best per user
      // We get all scores and deduplicate by user (highest)
      const { data: scores, error } = await supabaseClient
        .from('game_scores')
        .select('user_id, score')
        .eq('game_type', '2048')
        .order('score', { ascending: false })
        .limit(200)

      if (error) return errorResponse(error.message, 500)

      // Deduplicate: keep only best score per user
      const bestScores = new Map<string, number>()
      for (const s of (scores ?? [])) {
        if (!bestScores.has(s.user_id) || s.score > (bestScores.get(s.user_id) ?? 0)) {
          bestScores.set(s.user_id, s.score)
        }
      }

      // Sort and take top 20
      const sorted = [...bestScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)

      // Get user display names
      const userIds = sorted.map(([id]) => id)
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (userIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const leaderboard = sorted.map(([userId, score], index) => ({
        rank: index + 1,
        user_id: userId,
        display_name: userMap.get(userId)?.display_name ?? 'User',
        avatar_url: userMap.get(userId)?.avatar_url ?? null,
        score,
      }))

      return jsonResponse(leaderboard)
    }

    return errorResponse('Invalid action. Use: list-invites, create-invite, join-invite, leave-invite, close-invite, submit-score, leaderboard', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.4 — Create `supabase/functions/manage-feedbacks/index.ts`

- [ ] Create file `supabase/functions/manage-feedbacks/index.ts`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'list') {
      const { page = 1, pageSize = 20, category } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      let query = supabaseClient
        .from('feedbacks')
        .select('*', { count: 'exact' })
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (category && ['feature', 'event', 'bug'].includes(category)) {
        query = query.eq('category', category)
      }

      const { data: feedbacks, error, count } = await query

      if (error) return errorResponse(error.message, 500)

      // Check which feedbacks the current user has voted on
      const feedbackIds = (feedbacks ?? []).map((f: Record<string, unknown>) => f.id as string)
      let votedSet = new Set<string>()
      if (feedbackIds.length > 0) {
        const { data: votes } = await supabaseClient
          .from('feedback_votes')
          .select('feedback_id')
          .eq('user_id', user.id)
          .in('feedback_id', feedbackIds)

        if (votes) {
          votedSet = new Set(votes.map((v: { feedback_id: string }) => v.feedback_id))
        }
      }

      // Get author display names
      const authorIds = [...new Set((feedbacks ?? []).map((f: Record<string, unknown>) => f.author_id as string))]
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (authorIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (authorIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (feedbacks ?? []).map((f: Record<string, unknown>) => ({
        ...f,
        has_voted: votedSet.has(f.id as string),
        author_display_name: userMap.get(f.author_id as string)?.display_name ?? 'User',
        author_avatar_url: userMap.get(f.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({ feedbacks: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create') {
      const { category, title, content } = body

      if (!category || !['feature', 'event', 'bug'].includes(category)) {
        return errorResponse('Category must be one of: feature, event, bug', 400)
      }
      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }
      if (!content || typeof content !== 'string' || content.length < 1 || content.length > 2000) {
        return errorResponse('Content must be between 1 and 2000 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('feedbacks')
        .insert({ author_id: user.id, category, title, content })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Award +5 XP for submitting feedback
      await addXp(serviceClient, user.id, 5)

      return jsonResponse(data, 201)
    }

    if (action === 'vote') {
      const { feedback_id } = body
      if (!feedback_id) return errorResponse('Missing feedback_id', 400)

      // Check if already voted
      const { data: existingVote } = await supabaseClient
        .from('feedback_votes')
        .select('feedback_id')
        .eq('feedback_id', feedback_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingVote) {
        // Remove vote
        const { error: deleteError } = await supabaseClient
          .from('feedback_votes')
          .delete()
          .eq('feedback_id', feedback_id)
          .eq('user_id', user.id)

        if (deleteError) return errorResponse(deleteError.message, 500)

        // Decrement vote_count using service client
        const { data: feedback } = await serviceClient
          .from('feedbacks')
          .select('vote_count')
          .eq('id', feedback_id)
          .single()

        if (feedback) {
          await serviceClient
            .from('feedbacks')
            .update({ vote_count: Math.max(0, feedback.vote_count - 1) })
            .eq('id', feedback_id)
        }

        return jsonResponse({ voted: false })
      } else {
        // Add vote
        const { error: insertError } = await supabaseClient
          .from('feedback_votes')
          .insert({ feedback_id, user_id: user.id })

        if (insertError) return errorResponse(insertError.message, 500)

        // Increment vote_count using service client
        const { data: feedback } = await serviceClient
          .from('feedbacks')
          .select('vote_count')
          .eq('id', feedback_id)
          .single()

        if (feedback) {
          await serviceClient
            .from('feedbacks')
            .update({ vote_count: feedback.vote_count + 1 })
            .eq('id', feedback_id)
        }

        return jsonResponse({ voted: true })
      }
    }

    if (action === 'update-status') {
      // Moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, status } = body
      if (!id) return errorResponse('Missing feedback id', 400)
      if (!status || !['open', 'reviewed', 'accepted', 'rejected'].includes(status)) {
        return errorResponse('Status must be one of: open, reviewed, accepted, rejected', 400)
      }

      // ONLY update the status field — never spread the request body
      const { data, error } = await supabaseClient
        .from('feedbacks')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return errorResponse('Missing feedback id', 400)

      // RLS handles: author or admin can delete
      const { error } = await supabaseClient
        .from('feedbacks')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, vote, update-status, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.5 — Create `supabase/functions/manage-levels/index.ts`

- [ ] Create file `supabase/functions/manage-levels/index.ts`

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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'get') {
      const { data, error } = await supabaseClient
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'leaderboard') {
      const { data: levels, error } = await supabaseClient
        .from('user_levels')
        .select('user_id, xp, level, badges')
        .order('xp', { ascending: false })
        .limit(20)

      if (error) return errorResponse(error.message, 500)

      // Get user display names
      const userIds = (levels ?? []).map((l: Record<string, unknown>) => l.user_id as string)
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (userIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const leaderboard = (levels ?? []).map((l: Record<string, unknown>, index: number) => ({
        rank: index + 1,
        user_id: l.user_id,
        display_name: userMap.get(l.user_id as string)?.display_name ?? 'User',
        avatar_url: userMap.get(l.user_id as string)?.avatar_url ?? null,
        xp: l.xp,
        level: l.level,
        badges: l.badges,
      }))

      return jsonResponse(leaderboard)
    }

    if (action === 'grant-badge') {
      if (role !== 'admin') {
        return errorResponse('Admin role required', 403)
      }

      const { user_id: targetUserId, badge } = body
      if (!targetUserId) return errorResponse('Missing user_id', 400)
      if (!badge || typeof badge !== 'string') return errorResponse('Missing badge', 400)

      // Fetch current badges
      const { data: currentLevel, error: fetchError } = await serviceClient
        .from('user_levels')
        .select('badges')
        .eq('user_id', targetUserId)
        .single()

      if (fetchError || !currentLevel) return errorResponse('User not found', 404)

      const currentBadges: string[] = currentLevel.badges ?? []
      if (currentBadges.includes(badge)) {
        return errorResponse('User already has this badge', 400)
      }

      const { data, error } = await serviceClient
        .from('user_levels')
        .update({ badges: [...currentBadges, badge] })
        .eq('user_id', targetUserId)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: get, leaderboard, grant-badge', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.6 — Modify `supabase/functions/manage-events/index.ts`

- [ ] Modify file `supabase/functions/manage-events/index.ts` — change `verifyAuth` to `'member'`, add inline moderator checks for create/update/delete, add register/unregister/registrations actions

Replace the entire file with:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // CHANGED: lowered from 'moderator' to 'member' for registration actions
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json()
    const { action } = body

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'create') {
      // Inline role check: moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { title, description, date, time, location, attendees } = body
      const { data, error } = await supabaseClient
        .from('events')
        .insert({ title, description, date, time, location, attendees: attendees ?? 0 })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      // Inline role check: moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, ...updates } = body
      delete updates.action
      if (!id) return errorResponse('Missing event id', 400)

      const { data, error } = await supabaseClient
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      // Inline role check: admin only (preserved from original)
      if (role !== 'admin') {
        return errorResponse('Only admin can delete events', 403)
      }

      const { id } = body
      if (!id) return errorResponse('Missing event id', 400)

      const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'register') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      const { data, error } = await supabaseClient
        .from('event_registrations')
        .insert({ event_id, user_id: user.id })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') return errorResponse('Already registered', 400)
        return errorResponse(error.message, 500)
      }

      // Award +10 XP for registering
      await addXp(serviceClient, user.id, 10)

      return jsonResponse(data, 201)
    }

    if (action === 'unregister') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      // RLS ensures only own registration can be deleted
      const { error } = await supabaseClient
        .from('event_registrations')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'registrations') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      const { data: registrations, error } = await supabaseClient
        .from('event_registrations')
        .select('user_id, registered_at')
        .eq('event_id', event_id)
        .order('registered_at', { ascending: true })

      if (error) return errorResponse(error.message, 500)

      // Get display names + avatars
      const userIds = (registrations ?? []).map((r: Record<string, unknown>) => r.user_id as string)
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (userIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (registrations ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        display_name: userMap.get(r.user_id as string)?.display_name ?? 'User',
        avatar_url: userMap.get(r.user_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    return errorResponse('Invalid action. Use: create, update, delete, register, unregister, registrations', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

### Step 2.7 — Modify `supabase/functions/get-events/index.ts`

- [ ] Modify file `supabase/functions/get-events/index.ts` — add `registered` boolean + `registration_count` per event

Replace the entire file with:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, supabaseClient } = await verifyAuth(req, 'member')

    const { data: events, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('date', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    // Get registration data for all events
    const eventIds = (events ?? []).map((e: Record<string, unknown>) => e.id as string)

    let registrationCounts = new Map<string, number>()
    let userRegistrations = new Set<string>()

    if (eventIds.length > 0) {
      // Get all registrations for these events
      const { data: registrations } = await supabaseClient
        .from('event_registrations')
        .select('event_id, user_id')
        .in('event_id', eventIds)

      if (registrations) {
        for (const r of registrations) {
          const current = registrationCounts.get(r.event_id) ?? 0
          registrationCounts.set(r.event_id, current + 1)
          if (r.user_id === user.id) {
            userRegistrations.add(r.event_id)
          }
        }
      }
    }

    const enriched = (events ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      registration_count: registrationCounts.get(e.id as string) ?? 0,
      registered: userRegistrations.has(e.id as string),
    }))

    return jsonResponse(enriched)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

---

## Task 3: Update `src/services/edgeFunctions.js`

- [ ] Add all new API functions to `src/services/edgeFunctions.js`

Append the following entries inside the `edgeFunctions` object (after the existing `getUsers`/`updateUserRole` entries, before the closing `}`):

```js
  // Todos
  listTodos: ({ page, pageSize } = {}) =>
    invoke('manage-todos', { action: 'list', page, pageSize }),

  createTodo: ({ title, is_public }) =>
    invoke('manage-todos', { action: 'create', title, is_public }),

  updateTodo: (id, { title, completed } = {}) =>
    invoke('manage-todos', { action: 'update', id, title, completed }),

  deleteTodo: (id) =>
    invoke('manage-todos', { action: 'delete', id }),

  claimTodo: (id) =>
    invoke('manage-todos', { action: 'claim', id }),

  unclaimTodo: (id) =>
    invoke('manage-todos', { action: 'unclaim', id }),

  // Games
  listGameInvites: ({ page, pageSize } = {}) =>
    invoke('manage-games', { action: 'list-invites', page, pageSize }),

  createGameInvite: ({ game_type, title, description, max_players }) =>
    invoke('manage-games', { action: 'create-invite', game_type, title, description, max_players }),

  joinGameInvite: (id) =>
    invoke('manage-games', { action: 'join-invite', id }),

  leaveGameInvite: (id) =>
    invoke('manage-games', { action: 'leave-invite', id }),

  closeGameInvite: (id) =>
    invoke('manage-games', { action: 'close-invite', id }),

  submitGameScore: (score) =>
    invoke('manage-games', { action: 'submit-score', score }),

  getGameLeaderboard: () =>
    invoke('manage-games', { action: 'leaderboard' }),

  // Feedbacks
  listFeedbacks: ({ page, pageSize, category } = {}) =>
    invoke('manage-feedbacks', { action: 'list', page, pageSize, category }),

  createFeedback: ({ category, title, content }) =>
    invoke('manage-feedbacks', { action: 'create', category, title, content }),

  voteFeedback: (feedback_id) =>
    invoke('manage-feedbacks', { action: 'vote', feedback_id }),

  updateFeedbackStatus: (id, status) =>
    invoke('manage-feedbacks', { action: 'update-status', id, status }),

  deleteFeedback: (id) =>
    invoke('manage-feedbacks', { action: 'delete', id }),

  // Levels
  getMyLevel: () =>
    invoke('manage-levels', { action: 'get' }),

  getLevelLeaderboard: () =>
    invoke('manage-levels', { action: 'leaderboard' }),

  grantBadge: (user_id, badge) =>
    invoke('manage-levels', { action: 'grant-badge', user_id, badge }),

  // Event Registration
  registerEvent: (event_id) =>
    invoke('manage-events', { action: 'register', event_id }),

  unregisterEvent: (event_id) =>
    invoke('manage-events', { action: 'unregister', event_id }),

  getEventRegistrations: (event_id) =>
    invoke('manage-events', { action: 'registrations', event_id }),
```

---

## Task 4: Frontend Components (8 new)

### Step 4.1 — Create `src/components/TodoItem.jsx`

- [ ] Create file `src/components/TodoItem.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import DeleteIcon from '@mui/icons-material/Delete'

export default function TodoItem({ todo, onToggle, onDelete, canDelete }) {
  const { t } = useTranslation()

  return (
    <ListItem
      secondaryAction={
        canDelete && (
          <IconButton edge="end" aria-label={t('todos.delete')} onClick={() => onDelete(todo.id)} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      }
      disablePadding
      sx={{ pl: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Checkbox
          edge="start"
          checked={todo.completed}
          onChange={() => onToggle(todo.id, !todo.completed)}
          size="small"
        />
      </ListItemIcon>
      <ListItemText
        primary={todo.title}
        sx={{
          textDecoration: todo.completed ? 'line-through' : 'none',
          color: todo.completed ? 'text.disabled' : 'text.primary',
        }}
      />
    </ListItem>
  )
}
```

### Step 4.2 — Create `src/components/GameBoard2048.jsx`

- [ ] Create file `src/components/GameBoard2048.jsx`

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'

const GRID_SIZE = 4

const TILE_COLORS = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
}

function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function addRandomTile(board) {
  const empty = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c])
    }
  }
  if (empty.length === 0) return board
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const newBoard = board.map((row) => [...row])
  newBoard[r][c] = Math.random() < 0.9 ? 2 : 4
  return newBoard
}

function rotateBoard(board) {
  const n = board.length
  const rotated = createEmptyBoard()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = board[r][c]
    }
  }
  return rotated
}

function slideLeft(board) {
  let score = 0
  const newBoard = board.map((row) => {
    // Remove zeros
    let tiles = row.filter((v) => v !== 0)
    // Merge adjacent equal tiles
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i] === tiles[i + 1]) {
        tiles[i] *= 2
        score += tiles[i]
        tiles[i + 1] = 0
      }
    }
    // Remove zeros again after merge
    tiles = tiles.filter((v) => v !== 0)
    // Pad right with zeros
    while (tiles.length < GRID_SIZE) tiles.push(0)
    return tiles
  })
  return { board: newBoard, score }
}

function move(board, direction) {
  let rotated = board
  const rotations = { left: 0, up: 1, right: 2, down: 3 }
  const times = rotations[direction]

  // Rotate so we can always slide left
  for (let i = 0; i < times; i++) rotated = rotateBoard(rotated)

  const { board: slid, score } = slideLeft(rotated)

  // Rotate back
  let result = slid
  for (let i = 0; i < (4 - times) % 4; i++) result = rotateBoard(result)

  return { board: result, score }
}

function boardsEqual(a, b) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false
    }
  }
  return true
}

function isGameOver(board) {
  // Check for empty cells
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return false
    }
  }
  // Check for possible merges
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c]
      if (c < GRID_SIZE - 1 && board[r][c + 1] === val) return false
      if (r < GRID_SIZE - 1 && board[r + 1][c] === val) return false
    }
  }
  return true
}

function initBoard() {
  let board = createEmptyBoard()
  board = addRandomTile(board)
  board = addRandomTile(board)
  return board
}

export default function GameBoard2048({ bestScore = 0, onGameOver, onScoreUpdate }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [board, setBoard] = useState(() => initBoard())
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const boardRef = useRef(null)
  const touchStartRef = useRef(null)

  const handleMove = useCallback((direction) => {
    if (gameOver) return

    setBoard((prevBoard) => {
      const { board: newBoard, score: moveScore } = move(prevBoard, direction)

      if (boardsEqual(prevBoard, newBoard)) return prevBoard

      const withTile = addRandomTile(newBoard)

      setScore((prev) => {
        const newScore = prev + moveScore
        if (onScoreUpdate) onScoreUpdate(newScore)
        return newScore
      })

      if (isGameOver(withTile)) {
        setGameOver(true)
        // Defer onGameOver to allow state to update first
        setTimeout(() => {
          setScore((currentScore) => {
            if (onGameOver) onGameOver(currentScore)
            return currentScore
          })
        }, 100)
      }

      return withTile
    })
  }, [gameOver, onGameOver, onScoreUpdate])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      const keyMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const dir = keyMap[e.key]
      if (dir) {
        e.preventDefault()
        handleMove(dir)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  // Touch / swipe controls
  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const minSwipe = 30

      if (Math.max(absDx, absDy) < minSwipe) return

      if (absDx > absDy) {
        handleMove(dx > 0 ? 'right' : 'left')
      } else {
        handleMove(dy > 0 ? 'down' : 'up')
      }

      touchStartRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleMove])

  const handleNewGame = () => {
    setBoard(initBoard())
    setScore(0)
    setGameOver(false)
  }

  const cellSize = { xs: 64, sm: 80 }
  const gap = 8

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {/* Score bar */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">{t('games.score')}</Typography>
          <Typography variant="h5" fontWeight={700}>{score}</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">{t('games.bestScore')}</Typography>
          <Typography variant="h5" fontWeight={700}>{Math.max(bestScore, score)}</Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={handleNewGame}>{t('games.newGame')}</Button>
      </Box>

      {/* Board */}
      <Box
        ref={boardRef}
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: `${gap}px`,
          p: `${gap}px`,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : '#bbada0',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {board.flat().map((value, idx) => {
          const colors = TILE_COLORS[value] || { bg: theme.palette.primary.main, text: '#f9f6f2' }
          const isEmpty = value === 0
          return (
            <Box
              key={idx}
              sx={{
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                bgcolor: isEmpty
                  ? (theme.palette.mode === 'dark' ? 'grey.700' : '#cdc1b4')
                  : colors.bg,
                transition: 'background-color 0.15s ease',
              }}
            >
              {!isEmpty && (
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: value >= 1024 ? '1rem' : value >= 128 ? '1.2rem' : '1.5rem',
                    color: colors.text,
                    lineHeight: 1,
                  }}
                >
                  {value}
                </Typography>
              )}
            </Box>
          )
        })}

        {/* Game over overlay */}
        {gameOver && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 2,
              gap: 1,
            }}
          >
            <Typography variant="h5" color="white" fontWeight={700}>{t('games.gameOver')}</Typography>
            <Typography variant="h6" color="white">{t('games.score')}: {score}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
```

### Step 4.3 — Create `src/components/GameInviteCard.jsx`

- [ ] Create file `src/components/GameInviteCard.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import PeopleIcon from '@mui/icons-material/People'

export default function GameInviteCard({ invite, userId, onJoin, onLeave, onClose }) {
  const { t } = useTranslation()
  const isHost = invite.host_id === userId
  const isParticipant = invite.is_participant
  const isClosed = invite.status === 'closed'

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label={invite.game_type} size="small" color="primary" variant="outlined" />
          {isClosed && <Chip label={t('games.invites.closed')} size="small" color="default" />}
        </Box>
        <Typography variant="h6" gutterBottom>{invite.title}</Typography>
        {invite.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {invite.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Avatar src={invite.host_avatar_url} sx={{ width: 20, height: 20 }} />
          <Typography variant="caption" color="text.secondary">{invite.host_display_name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" color="action" />
          <Typography variant="body2">
            {t('games.invites.players', { current: invite.participant_count, max: invite.max_players })}
          </Typography>
        </Box>
      </CardContent>
      <CardActions>
        {!isClosed && !isHost && !isParticipant && (
          <Button size="small" variant="contained" onClick={() => onJoin(invite.id)}>
            {t('games.invites.join')}
          </Button>
        )}
        {!isClosed && isParticipant && !isHost && (
          <Button size="small" variant="outlined" onClick={() => onLeave(invite.id)}>
            {t('games.invites.leave')}
          </Button>
        )}
        {!isClosed && isHost && (
          <Button size="small" color="warning" variant="outlined" onClick={() => onClose(invite.id)}>
            {t('games.invites.close')}
          </Button>
        )}
      </CardActions>
    </Card>
  )
}
```

### Step 4.4 — Create `src/components/GameInviteDialog.jsx`

- [ ] Create file `src/components/GameInviteDialog.jsx`

```jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'

export default function GameInviteDialog({ open, onClose, onCreate }) {
  const { t } = useTranslation()
  const [gameType, setGameType] = useState('2048')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)

  const handleCreate = () => {
    if (!title.trim()) return
    onCreate({
      game_type: gameType,
      title: title.trim(),
      description: description.trim() || undefined,
      max_players: maxPlayers,
    })
    setTitle('')
    setDescription('')
    setGameType('2048')
    setMaxPlayers(4)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('games.invites.create')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t('games.invites.gameType')}
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
            fullWidth
          >
            <MenuItem value="2048">2048</MenuItem>
            <MenuItem value="external">{t('games.invites.external')}</MenuItem>
          </TextField>
          <TextField
            label={t('games.invites.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label={t('games.invites.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            label={t('games.invites.maxPlayers')}
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Math.max(1, parseInt(e.target.value) || 1))}
            fullWidth
            inputProps={{ min: 1 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!title.trim()}>
          {t('games.invites.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

### Step 4.5 — Create `src/components/FeedbackCard.jsx`

- [ ] Create file `src/components/FeedbackCard.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined'
import DeleteIcon from '@mui/icons-material/Delete'

const CATEGORY_COLORS = {
  feature: 'primary',
  event: 'secondary',
  bug: 'error',
}

const STATUS_LIST = ['open', 'reviewed', 'accepted', 'rejected']

export default function FeedbackCard({ feedback, userId, isModerator, onVote, onStatusChange, onDelete }) {
  const { t } = useTranslation()
  const isAuthor = feedback.author_id === userId

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={t(`feedback.${feedback.category}`)}
            size="small"
            color={CATEGORY_COLORS[feedback.category] || 'default'}
          />
          <Chip label={t(`feedback.status.${feedback.status}`)} size="small" variant="outlined" />
        </Box>

        <Typography variant="h6" gutterBottom>{feedback.title}</Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {feedback.content}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar src={feedback.author_avatar_url} sx={{ width: 24, height: 24 }} />
            <Typography variant="caption" color="text.secondary">{feedback.author_display_name}</Typography>
            <Typography variant="caption" color="text.disabled">
              {new Date(feedback.created_at).toLocaleDateString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Vote button */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => onVote(feedback.id)} color={feedback.has_voted ? 'primary' : 'default'}>
                {feedback.has_voted ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
              </IconButton>
              <Typography variant="body2">{t('feedback.votes', { count: feedback.vote_count })}</Typography>
            </Box>

            {/* Moderator status dropdown */}
            {isModerator && (
              <Select
                value={feedback.status}
                onChange={(e) => onStatusChange(feedback.id, e.target.value)}
                size="small"
                variant="outlined"
                sx={{ minWidth: 120, height: 32 }}
              >
                {STATUS_LIST.map((s) => (
                  <MenuItem key={s} value={s}>{t(`feedback.status.${s}`)}</MenuItem>
                ))}
              </Select>
            )}

            {/* Delete button for author */}
            {isAuthor && (
              <IconButton size="small" color="error" onClick={() => onDelete(feedback.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
```

### Step 4.6 — Create `src/components/FeedbackDialog.jsx`

- [ ] Create file `src/components/FeedbackDialog.jsx`

```jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'

export default function FeedbackDialog({ open, onClose, onCreate }) {
  const { t } = useTranslation()
  const [category, setCategory] = useState('feature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return
    onCreate({ category, title: title.trim(), content: content.trim() })
    setTitle('')
    setContent('')
    setCategory('feature')
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('feedback.create')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t('feedback.categoryLabel')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
          >
            <MenuItem value="feature">{t('feedback.feature')}</MenuItem>
            <MenuItem value="event">{t('feedback.event')}</MenuItem>
            <MenuItem value="bug">{t('feedback.bug')}</MenuItem>
          </TextField>
          <TextField
            label={t('feedback.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label={t('feedback.contentLabel')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            required
            multiline
            rows={4}
            inputProps={{ maxLength: 2000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || !content.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

### Step 4.7 — Create `src/components/LevelCard.jsx`

- [ ] Create file `src/components/LevelCard.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'

export default function LevelCard({ level, xp, badges, onLeaderboard }) {
  const { t } = useTranslation()

  // Level formula: level = floor(sqrt(xp / 10)) + 1
  // XP needed for next level: 10 * level^2
  const currentLevelMinXp = 10 * (level - 1) * (level - 1)
  const nextLevelMinXp = 10 * level * level
  const xpInLevel = xp - currentLevelMinXp
  const xpForLevel = nextLevelMinXp - currentLevelMinXp
  const progress = xpForLevel > 0 ? (xpInLevel / xpForLevel) * 100 : 0

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>{t('levels.title')}</Typography>
          </Box>
          <Button
            size="small"
            startIcon={<LeaderboardIcon />}
            onClick={onLeaderboard}
          >
            {t('levels.leaderboard')}
          </Button>
        </Box>

        <Typography variant="subtitle1" fontWeight={600}>
          {t('levels.level', { level })}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
            {t('levels.xp', { current: xp, next: nextLevelMinXp })}
          </Typography>
        </Box>

        {badges && badges.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{t('levels.badges')}:</Typography>
            {badges.map((badge) => (
              <Chip key={badge} label={badge} size="small" variant="outlined" />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">{t('levels.noBadges')}</Typography>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 4.8 — Create `src/components/LeaderboardDialog.jsx`

- [ ] Create file `src/components/LeaderboardDialog.jsx`

```jsx
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Shared leaderboard dialog.
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - title: string
 *   - rows: [{ rank, displayName, avatarUrl, value }]
 *   - valueLabel: string (e.g. "XP" or "Score")
 */
export default function LeaderboardDialog({ open, onClose, title, rows = [], valueLabel }) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('games.rank')}</TableCell>
                <TableCell>{t('games.player')}</TableCell>
                <TableCell align="right">{valueLabel}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rank}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={row.rank <= 3 ? 700 : 400}>
                      {row.rank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={row.avatarUrl} sx={{ width: 24, height: 24 }} />
                      <Typography variant="body2">{row.displayName}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>{row.value}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}
```

---

## Task 5: Rewrite Pages (4 pages)

### Step 5.1 — Rewrite `src/pages/Todos.jsx`

- [ ] Replace entire file `src/pages/Todos.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import TodoItem from '../components/TodoItem'

export default function Todos() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [snack, setSnack] = useState(null)

  const loadTodos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.listTodos({ pageSize: 100 })
      setTodos(data.todos ?? [])
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTodos() }, [loadTodos])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    try {
      await edgeFunctions.createTodo({ title, is_public: tab === 1 })
      setNewTitle('')
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggle = async (id, completed) => {
    try {
      await edgeFunctions.updateTodo(id, { completed })
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id) => {
    try {
      await edgeFunctions.deleteTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleClaim = async (id) => {
    try {
      await edgeFunctions.claimTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnclaim = async (id) => {
    try {
      await edgeFunctions.unclaimTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const personalTodos = todos.filter((t) => !t.is_public && t.user_id === user?.id)
  const communityTodos = todos.filter((t) => t.is_public)

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('todos.title')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('todos.personal')} />
        <Tab label={t('todos.community')} />
      </Tabs>

      {/* Add todo */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={t('todos.addPlaceholder')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          inputProps={{ maxLength: 200 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newTitle.trim()}>
          {t('todos.add')}
        </Button>
      </Box>

      {loading ? (
        <Stack spacing={1}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={48} />)}
        </Stack>
      ) : tab === 0 ? (
        /* Personal tab */
        personalTodos.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('todos.empty')}</Typography>
          </Card>
        ) : (
          <List>
            {personalTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
                canDelete={true}
              />
            ))}
          </List>
        )
      ) : (
        /* Community tab */
        communityTodos.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('todos.empty')}</Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {communityTodos.map((todo) => {
              const isCreator = todo.user_id === user?.id
              const isAssignee = todo.assigned_to === user?.id
              const statusKey = todo.completed ? 'completed' : todo.assigned_to ? 'claimedBy' : 'open'
              const statusLabel = todo.completed
                ? t('todos.completed')
                : todo.assigned_to
                  ? t('todos.claimedBy', { name: todo.assignee_display_name ?? '' })
                  : t('todos.open')
              const statusColor = todo.completed ? 'success' : todo.assigned_to ? 'warning' : 'default'

              return (
                <Card key={todo.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                          {todo.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Avatar src={todo.creator_avatar_url} sx={{ width: 20, height: 20 }} />
                          <Typography variant="caption" color="text.secondary">{todo.creator_display_name}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={statusLabel} size="small" color={statusColor} />
                        {!todo.completed && !todo.assigned_to && !isCreator && (
                          <Button size="small" variant="outlined" onClick={() => handleClaim(todo.id)}>
                            {t('todos.claim')}
                          </Button>
                        )}
                        {!todo.completed && isAssignee && (
                          <>
                            <Button size="small" variant="outlined" onClick={() => handleUnclaim(todo.id)}>
                              {t('todos.unclaim')}
                            </Button>
                            <Button size="small" variant="contained" onClick={() => handleToggle(todo.id, true)}>
                              {t('todos.completed')}
                            </Button>
                          </>
                        )}
                        {isCreator && (
                          <Button size="small" color="error" onClick={() => handleDelete(todo.id)}>
                            {t('todos.delete')}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
```

### Step 5.2 — Rewrite `src/pages/Games.jsx`

- [ ] Replace entire file `src/pages/Games.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import AddIcon from '@mui/icons-material/Add'
import GameBoard2048 from '../components/GameBoard2048'
import GameInviteCard from '../components/GameInviteCard'
import GameInviteDialog from '../components/GameInviteDialog'
import LeaderboardDialog from '../components/LeaderboardDialog'

export default function Games() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [snack, setSnack] = useState(null)

  // 2048 state
  const [bestScore, setBestScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [lastGameScore, setLastGameScore] = useState(null)

  // Invites state
  const [invites, setInvites] = useState([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [showCreateInvite, setShowCreateInvite] = useState(false)

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await edgeFunctions.getGameLeaderboard()
      setLeaderboard(data ?? [])
      // Find user's best score
      const myEntry = (data ?? []).find((e) => e.user_id === user?.id)
      if (myEntry) setBestScore(myEntry.score)
    } catch { /* ignore */ }
  }, [user?.id])

  const loadInvites = useCallback(async () => {
    try {
      setInvitesLoading(true)
      const data = await edgeFunctions.listGameInvites({ pageSize: 50 })
      setInvites(data.invites ?? [])
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setInvitesLoading(false)
    }
  }, [])

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { if (tab === 1) loadInvites() }, [tab, loadInvites])

  const handleGameOver = async (score) => {
    setLastGameScore(score)
    setScoreSubmitted(false)
  }

  const handleSubmitScore = async () => {
    if (lastGameScore == null) return
    try {
      const result = await edgeFunctions.submitGameScore(lastGameScore)
      if (result.saved) {
        setSnack({ severity: 'success', message: t('games.scoreSubmitted') })
        setBestScore(Math.max(bestScore, lastGameScore))
        loadLeaderboard()
      }
      setScoreSubmitted(true)
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleJoin = async (id) => {
    try {
      await edgeFunctions.joinGameInvite(id)
      loadInvites()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleLeave = async (id) => {
    try {
      await edgeFunctions.leaveGameInvite(id)
      loadInvites()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCloseInvite = async (id) => {
    try {
      await edgeFunctions.closeGameInvite(id)
      loadInvites()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCreateInvite = async (data) => {
    try {
      await edgeFunctions.createGameInvite(data)
      loadInvites()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const leaderboardRows = leaderboard.map((e) => ({
    rank: e.rank,
    displayName: e.display_name,
    avatarUrl: e.avatar_url,
    value: e.score,
  }))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('games.title')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('games.tab2048')} />
        <Tab label={t('games.tabInvites')} />
      </Tabs>

      {tab === 0 && (
        <Box>
          <GameBoard2048
            bestScore={bestScore}
            onGameOver={handleGameOver}
            onScoreUpdate={null}
          />

          {/* Submit score button (after game over) */}
          {lastGameScore != null && !scoreSubmitted && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleSubmitScore}>
                {t('games.submitScore')}
              </Button>
            </Box>
          )}

          {/* Leaderboard */}
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{t('games.leaderboard')}</Typography>
              <Button size="small" onClick={() => setShowLeaderboard(true)}>
                {t('games.leaderboard')}
              </Button>
            </Box>
          </Box>

          <LeaderboardDialog
            open={showLeaderboard}
            onClose={() => setShowLeaderboard(false)}
            title={t('games.leaderboard')}
            rows={leaderboardRows}
            valueLabel={t('games.score')}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ position: 'relative' }}>
          {invitesLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Skeleton variant="rectangular" height={180} />
                </Grid>
              ))}
            </Grid>
          ) : invites.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('games.invites.empty')}</Typography>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {invites.map((invite) => (
                <Grid key={invite.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <GameInviteCard
                    invite={invite}
                    userId={user?.id}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onClose={handleCloseInvite}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          <Fab
            color="primary"
            sx={{ position: 'fixed', bottom: 24, right: 24 }}
            onClick={() => setShowCreateInvite(true)}
          >
            <AddIcon />
          </Fab>

          <GameInviteDialog
            open={showCreateInvite}
            onClose={() => setShowCreateInvite(false)}
            onCreate={handleCreateInvite}
          />
        </Box>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
```

### Step 5.3 — Rewrite `src/pages/Feedback.jsx`

- [ ] Replace entire file `src/pages/Feedback.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Fab from '@mui/material/Fab'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackDialog from '../components/FeedbackDialog'

const CATEGORIES = ['all', 'feature', 'event', 'bug']

export default function Feedback() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const isModerator = hasRole('moderator')
  const [category, setCategory] = useState('all')
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [snack, setSnack] = useState(null)

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      const params = { pageSize: 50 }
      if (category !== 'all') params.category = category
      const data = await edgeFunctions.listFeedbacks(params)
      setFeedbacks(data.feedbacks ?? [])
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { loadFeedbacks() }, [loadFeedbacks])

  const handleVote = async (feedbackId) => {
    // Optimistic update
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === feedbackId
          ? {
              ...f,
              has_voted: !f.has_voted,
              vote_count: f.has_voted ? f.vote_count - 1 : f.vote_count + 1,
            }
          : f
      )
    )

    try {
      await edgeFunctions.voteFeedback(feedbackId)
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
      loadFeedbacks() // Revert on error
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, status)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id)
      setSnack({ severity: 'success', message: t('feedback.deleted') })
      loadFeedbacks()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCreate = async (data) => {
    try {
      await edgeFunctions.createFeedback(data)
      setSnack({ severity: 'success', message: t('feedback.created') })
      loadFeedbacks()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('feedback.title')}</Typography>

      {/* Category filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={t(`feedback.${cat}`)}
            onClick={() => setCategory(cat)}
            color={category === cat ? 'primary' : 'default'}
            variant={category === cat ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={120} />)}
        </Stack>
      ) : feedbacks.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('feedback.empty')}</Typography>
        </Card>
      ) : (
        <Stack>
          {feedbacks.map((fb) => (
            <FeedbackCard
              key={fb.id}
              feedback={fb}
              userId={user?.id}
              isModerator={isModerator}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setShowCreate(true)}
      >
        <AddIcon />
      </Fab>

      <FeedbackDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
```

### Step 5.4 — Enhance `src/pages/Events.jsx`

- [ ] Replace entire file `src/pages/Events.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
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
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import EventIcon from '@mui/icons-material/Event'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PeopleIcon from '@mui/icons-material/People'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LevelCard from '../components/LevelCard'
import LeaderboardDialog from '../components/LeaderboardDialog'

export default function Events() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snack, setSnack] = useState(null)

  // Level state
  const [levelData, setLevelData] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])

  // Expanded events (for registrant list)
  const [expanded, setExpanded] = useState({})
  const [registrants, setRegistrants] = useState({})

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.getEvents()
      setEvents(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLevel = useCallback(async () => {
    try {
      const data = await edgeFunctions.getMyLevel()
      setLevelData(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadLevel() }, [loadLevel])

  const handleRegister = async (eventId) => {
    try {
      await edgeFunctions.registerEvent(eventId)
      setSnack({ severity: 'success', message: t('events.registered') })
      loadEvents()
      loadLevel()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnregister = async (eventId) => {
    try {
      await edgeFunctions.unregisterEvent(eventId)
      loadEvents()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggleExpand = async (eventId) => {
    const isExpanded = !!expanded[eventId]
    setExpanded((prev) => ({ ...prev, [eventId]: !isExpanded }))

    if (!isExpanded && !registrants[eventId]) {
      try {
        const data = await edgeFunctions.getEventRegistrations(eventId)
        setRegistrants((prev) => ({ ...prev, [eventId]: data ?? [] }))
      } catch { /* ignore */ }
    }
  }

  const handleOpenLeaderboard = async () => {
    try {
      const data = await edgeFunctions.getLevelLeaderboard()
      setLeaderboard(data ?? [])
      setShowLeaderboard(true)
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const leaderboardRows = leaderboard.map((e) => ({
    rank: e.rank,
    displayName: e.display_name,
    avatarUrl: e.avatar_url,
    value: e.xp,
  }))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('events.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('events.subtitle')}</Typography>

      {/* Level card */}
      {levelData && (
        <LevelCard
          level={levelData.level}
          xp={levelData.xp}
          badges={levelData.badges}
          onLeaderboard={handleOpenLeaderboard}
        />
      )}

      <LeaderboardDialog
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        title={t('levels.leaderboard')}
        rows={leaderboardRows}
        valueLabel="XP"
      />

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
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {t('events.attendees', { count: event.registration_count ?? event.attendees ?? 0 })}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Register/Unregister button */}
                  <Box sx={{ mt: 2 }}>
                    {event.registered ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleUnregister(event.id)}
                        >
                          {t('events.registered')}
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleRegister(event.id)}
                      >
                        {t('events.register')}
                      </Button>
                    )}
                  </Box>

                  {/* Expand registrants */}
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => handleToggleExpand(event.id)}
                    endIcon={expanded[event.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {t('events.registrants')}
                  </Button>

                  <Collapse in={!!expanded[event.id]}>
                    <Box sx={{ mt: 1 }}>
                      {registrants[event.id]?.length > 0 ? (
                        <AvatarGroup max={10} sx={{ justifyContent: 'flex-start' }}>
                          {registrants[event.id].map((r) => (
                            <Avatar key={r.user_id} src={r.avatar_url} alt={r.display_name} sx={{ width: 28, height: 28 }} />
                          ))}
                        </AvatarGroup>
                      ) : (
                        <Typography variant="caption" color="text.secondary">{t('events.noRegistrants')}</Typography>
                      )}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
```

---

## Task 6: Update i18n Locale Files

### Step 6.1 — Update `src/i18n/locales/en.json`

- [ ] Merge the following keys into the existing `en.json` (add after existing keys, before closing `}`):

```json
  "todos.title": "To-Do",
  "todos.personal": "Personal",
  "todos.community": "Community",
  "todos.add": "Add task",
  "todos.addPlaceholder": "What needs to be done?",
  "todos.empty": "No tasks yet",
  "todos.claim": "Claim",
  "todos.unclaim": "Unclaim",
  "todos.claimedBy": "Claimed by {{name}}",
  "todos.completed": "Completed",
  "todos.open": "Open",
  "todos.delete": "Delete",
  "games.title": "Games",
  "games.tab2048": "2048",
  "games.tabInvites": "Game Invites",
  "games.score": "Score",
  "games.bestScore": "Best",
  "games.gameOver": "Game Over!",
  "games.submitScore": "Submit Score",
  "games.scoreSubmitted": "Score submitted!",
  "games.newGame": "New Game",
  "games.leaderboard": "Leaderboard",
  "games.rank": "Rank",
  "games.player": "Player",
  "games.invites.title": "Game Invites",
  "games.invites.create": "Create Invite",
  "games.invites.gameType": "Game Type",
  "games.invites.external": "External Game",
  "games.invites.titleLabel": "Title",
  "games.invites.description": "Description",
  "games.invites.maxPlayers": "Max Players",
  "games.invites.join": "Join",
  "games.invites.leave": "Leave",
  "games.invites.close": "Close",
  "games.invites.players": "{{current}}/{{max}} players",
  "games.invites.empty": "No open invites",
  "games.invites.closed": "Closed",
  "feedback.title": "Feedback",
  "feedback.all": "All",
  "feedback.feature": "Feature",
  "feedback.event": "Event",
  "feedback.bug": "Bug",
  "feedback.create": "New Feedback",
  "feedback.titleLabel": "Title",
  "feedback.contentLabel": "Content",
  "feedback.categoryLabel": "Category",
  "feedback.votes": "{{count}} votes",
  "feedback.vote": "Vote",
  "feedback.status.open": "Open",
  "feedback.status.reviewed": "Reviewed",
  "feedback.status.accepted": "Accepted",
  "feedback.status.rejected": "Rejected",
  "feedback.changeStatus": "Change Status",
  "feedback.delete": "Delete",
  "feedback.confirmDelete": "Delete this feedback?",
  "feedback.empty": "No feedback yet. Be the first!",
  "feedback.created": "Feedback submitted",
  "feedback.deleted": "Feedback deleted",
  "events.register": "Register",
  "events.registered": "Registered",
  "events.unregister": "Cancel Registration",
  "events.registrants": "Registrants",
  "events.noRegistrants": "No registrants yet",
  "levels.title": "My Level",
  "levels.level": "Level {{level}}",
  "levels.xp": "{{current}} / {{next}} XP",
  "levels.badges": "Badges",
  "levels.noBadges": "No badges yet",
  "levels.leaderboard": "Level Leaderboard",
  "common.save": "Save",
  "common.confirm": "Confirm"
```

### Step 6.2 — Update `src/i18n/locales/ja.json`

- [ ] Merge the following keys into the existing `ja.json`:

```json
  "todos.title": "To-Do",
  "todos.personal": "個人",
  "todos.community": "コミュニティ",
  "todos.add": "タスクを追加",
  "todos.addPlaceholder": "何をする必要がありますか？",
  "todos.empty": "タスクはまだありません",
  "todos.claim": "担当する",
  "todos.unclaim": "担当を外す",
  "todos.claimedBy": "{{name}}が担当中",
  "todos.completed": "完了",
  "todos.open": "未着手",
  "todos.delete": "削除",
  "games.title": "ゲーム",
  "games.tab2048": "2048",
  "games.tabInvites": "ゲーム招待",
  "games.score": "スコア",
  "games.bestScore": "ベスト",
  "games.gameOver": "ゲームオーバー！",
  "games.submitScore": "スコアを送信",
  "games.scoreSubmitted": "スコアを送信しました！",
  "games.newGame": "新しいゲーム",
  "games.leaderboard": "ランキング",
  "games.rank": "順位",
  "games.player": "プレイヤー",
  "games.invites.title": "ゲーム招待",
  "games.invites.create": "招待を作成",
  "games.invites.gameType": "ゲームタイプ",
  "games.invites.external": "外部ゲーム",
  "games.invites.titleLabel": "タイトル",
  "games.invites.description": "説明",
  "games.invites.maxPlayers": "最大人数",
  "games.invites.join": "参加",
  "games.invites.leave": "退出",
  "games.invites.close": "閉じる",
  "games.invites.players": "{{current}}/{{max}}人",
  "games.invites.empty": "招待はまだありません",
  "games.invites.closed": "終了",
  "feedback.title": "フィードバック",
  "feedback.all": "すべて",
  "feedback.feature": "機能",
  "feedback.event": "イベント",
  "feedback.bug": "バグ",
  "feedback.create": "新しいフィードバック",
  "feedback.titleLabel": "タイトル",
  "feedback.contentLabel": "内容",
  "feedback.categoryLabel": "カテゴリ",
  "feedback.votes": "{{count}}票",
  "feedback.vote": "投票",
  "feedback.status.open": "未対応",
  "feedback.status.reviewed": "確認済み",
  "feedback.status.accepted": "採用",
  "feedback.status.rejected": "不採用",
  "feedback.changeStatus": "ステータス変更",
  "feedback.delete": "削除",
  "feedback.confirmDelete": "このフィードバックを削除しますか？",
  "feedback.empty": "フィードバックはまだありません。最初の投稿をしましょう！",
  "feedback.created": "フィードバックを送信しました",
  "feedback.deleted": "フィードバックを削除しました",
  "events.register": "登録",
  "events.registered": "登録済み",
  "events.unregister": "登録をキャンセル",
  "events.registrants": "参加者",
  "events.noRegistrants": "参加者はまだいません",
  "levels.title": "マイレベル",
  "levels.level": "レベル {{level}}",
  "levels.xp": "{{current}} / {{next}} XP",
  "levels.badges": "バッジ",
  "levels.noBadges": "バッジはまだありません",
  "levels.leaderboard": "レベルランキング",
  "common.save": "保存",
  "common.confirm": "確認"
```

### Step 6.3 — Update `src/i18n/locales/zh-CN.json`

- [ ] Merge the following keys into the existing `zh-CN.json`:

```json
  "todos.title": "待办事项",
  "todos.personal": "个人",
  "todos.community": "社区",
  "todos.add": "添加任务",
  "todos.addPlaceholder": "需要做什么？",
  "todos.empty": "暂无任务",
  "todos.claim": "领取",
  "todos.unclaim": "取消领取",
  "todos.claimedBy": "{{name}} 已领取",
  "todos.completed": "已完成",
  "todos.open": "待处理",
  "todos.delete": "删除",
  "games.title": "游戏",
  "games.tab2048": "2048",
  "games.tabInvites": "游戏邀请",
  "games.score": "分数",
  "games.bestScore": "最佳",
  "games.gameOver": "游戏结束！",
  "games.submitScore": "提交分数",
  "games.scoreSubmitted": "分数已提交！",
  "games.newGame": "新游戏",
  "games.leaderboard": "排行榜",
  "games.rank": "排名",
  "games.player": "玩家",
  "games.invites.title": "游戏邀请",
  "games.invites.create": "创建邀请",
  "games.invites.gameType": "游戏类型",
  "games.invites.external": "外部游戏",
  "games.invites.titleLabel": "标题",
  "games.invites.description": "描述",
  "games.invites.maxPlayers": "最大人数",
  "games.invites.join": "加入",
  "games.invites.leave": "退出",
  "games.invites.close": "关闭",
  "games.invites.players": "{{current}}/{{max}} 人",
  "games.invites.empty": "暂无邀请",
  "games.invites.closed": "已关闭",
  "feedback.title": "反馈",
  "feedback.all": "全部",
  "feedback.feature": "功能",
  "feedback.event": "活动",
  "feedback.bug": "Bug",
  "feedback.create": "新建反馈",
  "feedback.titleLabel": "标题",
  "feedback.contentLabel": "内容",
  "feedback.categoryLabel": "分类",
  "feedback.votes": "{{count}} 票",
  "feedback.vote": "投票",
  "feedback.status.open": "待处理",
  "feedback.status.reviewed": "已审核",
  "feedback.status.accepted": "已采纳",
  "feedback.status.rejected": "已拒绝",
  "feedback.changeStatus": "更改状态",
  "feedback.delete": "删除",
  "feedback.confirmDelete": "确定删除此反馈？",
  "feedback.empty": "暂无反馈，成为第一个提交的人吧！",
  "feedback.created": "反馈已提交",
  "feedback.deleted": "反馈已删除",
  "events.register": "报名",
  "events.registered": "已报名",
  "events.unregister": "取消报名",
  "events.registrants": "参与者",
  "events.noRegistrants": "暂无参与者",
  "levels.title": "我的等级",
  "levels.level": "等级 {{level}}",
  "levels.xp": "{{current}} / {{next}} XP",
  "levels.badges": "徽章",
  "levels.noBadges": "暂无徽章",
  "levels.leaderboard": "等级排行榜",
  "common.save": "保存",
  "common.confirm": "确认"
```

### Step 6.4 — Update `src/i18n/locales/zh-TW.json`

- [ ] Merge the following keys into the existing `zh-TW.json`:

```json
  "todos.title": "待辦事項",
  "todos.personal": "個人",
  "todos.community": "社群",
  "todos.add": "新增任務",
  "todos.addPlaceholder": "需要做什麼？",
  "todos.empty": "目前沒有任務",
  "todos.claim": "領取",
  "todos.unclaim": "取消領取",
  "todos.claimedBy": "{{name}} 已領取",
  "todos.completed": "已完成",
  "todos.open": "待處理",
  "todos.delete": "刪除",
  "games.title": "遊戲",
  "games.tab2048": "2048",
  "games.tabInvites": "遊戲邀請",
  "games.score": "分數",
  "games.bestScore": "最佳",
  "games.gameOver": "遊戲結束！",
  "games.submitScore": "提交分數",
  "games.scoreSubmitted": "分數已提交！",
  "games.newGame": "新遊戲",
  "games.leaderboard": "排行榜",
  "games.rank": "排名",
  "games.player": "玩家",
  "games.invites.title": "遊戲邀請",
  "games.invites.create": "建立邀請",
  "games.invites.gameType": "遊戲類型",
  "games.invites.external": "外部遊戲",
  "games.invites.titleLabel": "標題",
  "games.invites.description": "說明",
  "games.invites.maxPlayers": "最大人數",
  "games.invites.join": "加入",
  "games.invites.leave": "退出",
  "games.invites.close": "關閉",
  "games.invites.players": "{{current}}/{{max}} 人",
  "games.invites.empty": "目前沒有邀請",
  "games.invites.closed": "已關閉",
  "feedback.title": "回饋",
  "feedback.all": "全部",
  "feedback.feature": "功能",
  "feedback.event": "活動",
  "feedback.bug": "Bug",
  "feedback.create": "新增回饋",
  "feedback.titleLabel": "標題",
  "feedback.contentLabel": "內容",
  "feedback.categoryLabel": "分類",
  "feedback.votes": "{{count}} 票",
  "feedback.vote": "投票",
  "feedback.status.open": "待處理",
  "feedback.status.reviewed": "已審核",
  "feedback.status.accepted": "已採納",
  "feedback.status.rejected": "已拒絕",
  "feedback.changeStatus": "變更狀態",
  "feedback.delete": "刪除",
  "feedback.confirmDelete": "確定刪除此回饋？",
  "feedback.empty": "目前沒有回饋，成為第一個提交的人吧！",
  "feedback.created": "回饋已提交",
  "feedback.deleted": "回饋已刪除",
  "events.register": "報名",
  "events.registered": "已報名",
  "events.unregister": "取消報名",
  "events.registrants": "參與者",
  "events.noRegistrants": "目前沒有參與者",
  "levels.title": "我的等級",
  "levels.level": "等級 {{level}}",
  "levels.xp": "{{current}} / {{next}} XP",
  "levels.badges": "徽章",
  "levels.noBadges": "目前沒有徽章",
  "levels.leaderboard": "等級排行榜",
  "common.save": "儲存",
  "common.confirm": "確認"
```

---

## Task 7: Build Verification

- [ ] Run `npm run build` and verify zero errors
- [ ] Git commit all changes
- [ ] Git push to remote

---

## File Summary

### New files (18)

| # | File | Description |
|---|------|-------------|
| 1 | `supabase/migrations/006_todos.sql` | Todos table + RLS |
| 2 | `supabase/migrations/007_games.sql` | Game invites, participants, scores + RLS |
| 3 | `supabase/migrations/008_feedbacks.sql` | Feedbacks + feedback_votes + RLS |
| 4 | `supabase/migrations/009_event_registrations.sql` | Event registrations + RLS |
| 5 | `supabase/migrations/010_user_levels.sql` | User levels + trigger + backfill + atomic XP function + RLS |
| 6 | `supabase/functions/_shared/xp.ts` | Shared atomic XP helper |
| 7 | `supabase/functions/manage-todos/index.ts` | Todos CRUD + claim/unclaim |
| 8 | `supabase/functions/manage-games/index.ts` | Game invites + scores + leaderboard |
| 9 | `supabase/functions/manage-feedbacks/index.ts` | Feedbacks CRUD + voting + status |
| 10 | `supabase/functions/manage-levels/index.ts` | Level get/leaderboard/grant-badge |
| 11 | `src/components/TodoItem.jsx` | Todo list item component |
| 12 | `src/components/GameBoard2048.jsx` | Full 2048 game |
| 13 | `src/components/GameInviteCard.jsx` | Game invite card |
| 14 | `src/components/GameInviteDialog.jsx` | Create game invite dialog |
| 15 | `src/components/FeedbackCard.jsx` | Feedback card with voting |
| 16 | `src/components/FeedbackDialog.jsx` | Create feedback dialog |
| 17 | `src/components/LevelCard.jsx` | Level/XP/badges display |
| 18 | `src/components/LeaderboardDialog.jsx` | Shared leaderboard dialog |

### Modified files (7)

| # | File | Changes |
|---|------|---------|
| 1 | `supabase/functions/manage-events/index.ts` | Lower auth to member, add inline role checks, add register/unregister/registrations |
| 2 | `supabase/functions/get-events/index.ts` | Add registered boolean + registration_count |
| 3 | `src/services/edgeFunctions.js` | Add all Batch B API functions |
| 4 | `src/pages/Todos.jsx` | Full rewrite from stub |
| 5 | `src/pages/Games.jsx` | Full rewrite from stub |
| 6 | `src/pages/Feedback.jsx` | Full rewrite from stub |
| 7 | `src/pages/Events.jsx` | Enhanced with registration + level card |
| 8 | `src/i18n/locales/en.json` | Add Batch B translation keys |
| 9 | `src/i18n/locales/ja.json` | Add Batch B translation keys |
| 10 | `src/i18n/locales/zh-CN.json` | Add Batch B translation keys |
| 11 | `src/i18n/locales/zh-TW.json` | Add Batch B translation keys |
