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
