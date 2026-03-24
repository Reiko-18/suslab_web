-- ================================================================
-- SUSLAB WEB — Complete Supabase Setup Script
-- Run this ENTIRE script in the Supabase SQL Editor (one shot)
-- ================================================================
-- Order: 001 → 001b → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010

-- ============================================
-- 001: user_roles table, triggers, JWT hook
-- ============================================

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_user_id_unique unique (user_id)
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_user_roles_updated
  before update on public.user_roles
  for each row execute procedure public.handle_updated_at();

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'member');
  return new;
end;
$$;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  claims jsonb;
  user_role text;
begin
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(user_role, 'member'))
  );

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant all on table public.user_roles to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

insert into public.user_roles (user_id, role)
select id, 'member' from auth.users
where id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;


-- ============================================
-- 001b: events table
-- ============================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  date date not null,
  time time,
  location text check (char_length(location) <= 300),
  attendees integer not null default 0 check (attendees >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_events_updated
  before update on public.events
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_events_date on public.events (date asc);


-- ============================================
-- 002: RLS policies for events + user_roles
-- ============================================

alter table public.events enable row level security;

create policy "events_select_authenticated"
on public.events for select
to authenticated
using (true);

create policy "events_insert_moderator"
on public.events for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

create policy "events_update_moderator"
on public.events for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

create policy "events_delete_admin"
on public.events for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

alter table public.user_roles enable row level security;

create policy "user_roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "user_roles_update_admin"
on public.user_roles for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "user_roles_delete_admin"
on public.user_roles for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);


-- ============================================
-- 003: member_profiles table
-- ============================================

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 500),
  skill_tags text[] not null default '{}',
  social_links jsonb not null default '{}',
  visibility jsonb not null default '{"bio": true, "email": true, "skill_tags": true, "social_links": true, "avatar": true, "role": true, "join_date": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_member_profiles_updated
  before update on public.member_profiles
  for each row execute procedure public.handle_updated_at();

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

insert into public.member_profiles (user_id)
select id from auth.users
where id not in (select user_id from public.member_profiles)
on conflict (user_id) do nothing;

alter table public.member_profiles enable row level security;

create policy "member_profiles_select_authenticated"
on public.member_profiles for select
to authenticated
using (true);

create policy "member_profiles_update_own"
on public.member_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "member_profiles_delete_admin"
on public.member_profiles for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);


-- ============================================
-- 004: profile_comments table
-- ============================================

create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_comments_profile_user_id
on public.profile_comments (profile_user_id, created_at asc);

alter table public.profile_comments enable row level security;

create policy "profile_comments_select_authenticated"
on public.profile_comments for select
to authenticated
using (true);

create policy "profile_comments_insert_authenticated"
on public.profile_comments for insert
to authenticated
with check (author_id = auth.uid());

create policy "profile_comments_delete_owner_or_admin"
on public.profile_comments for delete
to authenticated
using (
  profile_user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);


-- ============================================
-- 005: announcements table
-- ============================================

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

create trigger on_announcements_updated
  before update on public.announcements
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_announcements_listing
on public.announcements (pinned desc, created_at desc);

alter table public.announcements enable row level security;

create policy "announcements_select_authenticated"
on public.announcements for select
to authenticated
using (true);

create policy "announcements_insert_moderator"
on public.announcements for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

create policy "announcements_update_moderator"
on public.announcements for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

create policy "announcements_delete_admin"
on public.announcements for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);


-- ============================================
-- 006: todos table
-- ============================================

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

create trigger on_todos_updated
  before update on public.todos
  for each row execute procedure public.handle_updated_at();

alter table public.todos enable row level security;

create policy "todos_select_own_or_public"
on public.todos for select
to authenticated
using (
  user_id = auth.uid() or is_public = true
);

create policy "todos_insert_own"
on public.todos for insert
to authenticated
with check (user_id = auth.uid());

create policy "todos_update_creator_or_assignee"
on public.todos for update
to authenticated
using (
  user_id = auth.uid() or assigned_to = auth.uid()
)
with check (
  user_id = auth.uid() or assigned_to = auth.uid()
);

create policy "todos_delete_creator"
on public.todos for delete
to authenticated
using (user_id = auth.uid());


-- ============================================
-- 007: games tables (invites, participants, scores)
-- ============================================

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

create policy "game_invites_select_authenticated"
on public.game_invites for select
to authenticated
using (true);

create policy "game_invites_insert_own"
on public.game_invites for insert
to authenticated
with check (host_id = auth.uid());

create policy "game_invites_update_host"
on public.game_invites for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

create policy "game_invites_delete_host_or_admin"
on public.game_invites for delete
to authenticated
using (
  host_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create table if not exists public.game_invite_participants (
  invite_id uuid not null references public.game_invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

alter table public.game_invite_participants enable row level security;

create policy "game_invite_participants_select_authenticated"
on public.game_invite_participants for select
to authenticated
using (true);

create policy "game_invite_participants_insert_own"
on public.game_invite_participants for insert
to authenticated
with check (user_id = auth.uid());

create policy "game_invite_participants_delete_own"
on public.game_invite_participants for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_type text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

alter table public.game_scores enable row level security;

create policy "game_scores_select_authenticated"
on public.game_scores for select
to authenticated
using (true);

create policy "game_scores_insert_own"
on public.game_scores for insert
to authenticated
with check (user_id = auth.uid());


-- ============================================
-- 008: feedbacks + feedback_votes tables
-- ============================================

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

create policy "feedbacks_select_authenticated"
on public.feedbacks for select
to authenticated
using (true);

create policy "feedbacks_insert_own"
on public.feedbacks for insert
to authenticated
with check (author_id = auth.uid());

create policy "feedbacks_update_moderator"
on public.feedbacks for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

create policy "feedbacks_delete_author_or_admin"
on public.feedbacks for delete
to authenticated
using (
  author_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create table if not exists public.feedback_votes (
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (feedback_id, user_id)
);

alter table public.feedback_votes enable row level security;

create policy "feedback_votes_select_authenticated"
on public.feedback_votes for select
to authenticated
using (true);

create policy "feedback_votes_insert_own"
on public.feedback_votes for insert
to authenticated
with check (user_id = auth.uid());

create policy "feedback_votes_delete_own"
on public.feedback_votes for delete
to authenticated
using (user_id = auth.uid());


-- ============================================
-- 009: event_registrations table
-- ============================================

create table if not exists public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  registered_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_registrations enable row level security;

create policy "event_registrations_select_authenticated"
on public.event_registrations for select
to authenticated
using (true);

create policy "event_registrations_insert_own"
on public.event_registrations for insert
to authenticated
with check (user_id = auth.uid());

create policy "event_registrations_delete_own_or_admin"
on public.event_registrations for delete
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);


-- ============================================
-- 010: user_levels table + atomic XP function
-- ============================================

create table if not exists public.user_levels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  badges text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger on_user_levels_updated
  before update on public.user_levels
  for each row execute procedure public.handle_updated_at();

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

insert into public.user_levels (user_id)
select id from auth.users
where id not in (select user_id from public.user_levels)
on conflict (user_id) do nothing;

alter table public.user_levels enable row level security;

create policy "user_levels_select_authenticated"
on public.user_levels for select
to authenticated
using (true);

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


-- ================================================================
-- DONE! All tables, triggers, functions, indexes, RLS, and
-- backfills have been created.
-- ================================================================
