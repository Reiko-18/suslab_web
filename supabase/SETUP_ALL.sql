-- ================================================================
-- SUSLAB WEB — Complete Supabase Setup Script (IDEMPOTENT)
-- Safe to run multiple times. Drops triggers/policies before
-- recreating them so it won't fail on "already exists".
-- Run this ENTIRE script in the Supabase SQL Editor (one shot)
-- ================================================================
-- Order: 001 → 001b → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 018 → 019 → 020

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

drop trigger if exists on_user_roles_updated on public.user_roles;
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

drop trigger if exists on_auth_user_created_role on auth.users;
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

drop trigger if exists on_events_updated on public.events;
create trigger on_events_updated
  before update on public.events
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_events_date on public.events (date asc);


-- ============================================
-- 002: RLS policies for events + user_roles
-- ============================================

alter table public.events enable row level security;

drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
on public.events for select
to authenticated
using (true);

drop policy if exists "events_insert_moderator" on public.events;
create policy "events_insert_moderator"
on public.events for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

drop policy if exists "events_update_moderator" on public.events;
create policy "events_update_moderator"
on public.events for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin"
on public.events for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "user_roles_update_admin" on public.user_roles;
create policy "user_roles_update_admin"
on public.user_roles for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "user_roles_delete_admin" on public.user_roles;
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

drop trigger if exists on_member_profiles_updated on public.member_profiles;
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

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

insert into public.member_profiles (user_id)
select id from auth.users
where id not in (select user_id from public.member_profiles)
on conflict (user_id) do nothing;

alter table public.member_profiles enable row level security;

drop policy if exists "member_profiles_select_authenticated" on public.member_profiles;
create policy "member_profiles_select_authenticated"
on public.member_profiles for select
to authenticated
using (true);

drop policy if exists "member_profiles_update_own" on public.member_profiles;
create policy "member_profiles_update_own"
on public.member_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "member_profiles_delete_admin" on public.member_profiles;
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

drop policy if exists "profile_comments_select_authenticated" on public.profile_comments;
create policy "profile_comments_select_authenticated"
on public.profile_comments for select
to authenticated
using (true);

drop policy if exists "profile_comments_insert_authenticated" on public.profile_comments;
create policy "profile_comments_insert_authenticated"
on public.profile_comments for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "profile_comments_delete_owner_or_admin" on public.profile_comments;
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

drop trigger if exists on_announcements_updated on public.announcements;
create trigger on_announcements_updated
  before update on public.announcements
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_announcements_listing
on public.announcements (pinned desc, created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated"
on public.announcements for select
to authenticated
using (true);

drop policy if exists "announcements_insert_moderator" on public.announcements;
create policy "announcements_insert_moderator"
on public.announcements for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

drop policy if exists "announcements_update_moderator" on public.announcements;
create policy "announcements_update_moderator"
on public.announcements for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

drop policy if exists "announcements_delete_admin" on public.announcements;
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

drop trigger if exists on_todos_updated on public.todos;
create trigger on_todos_updated
  before update on public.todos
  for each row execute procedure public.handle_updated_at();

alter table public.todos enable row level security;

drop policy if exists "todos_select_own_or_public" on public.todos;
create policy "todos_select_own_or_public"
on public.todos for select
to authenticated
using (
  user_id = auth.uid() or is_public = true
);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own"
on public.todos for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "todos_update_creator_or_assignee" on public.todos;
create policy "todos_update_creator_or_assignee"
on public.todos for update
to authenticated
using (
  user_id = auth.uid() or assigned_to = auth.uid()
)
with check (
  user_id = auth.uid() or assigned_to = auth.uid()
);

drop policy if exists "todos_delete_creator" on public.todos;
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

drop policy if exists "game_invites_select_authenticated" on public.game_invites;
create policy "game_invites_select_authenticated"
on public.game_invites for select
to authenticated
using (true);

drop policy if exists "game_invites_insert_own" on public.game_invites;
create policy "game_invites_insert_own"
on public.game_invites for insert
to authenticated
with check (host_id = auth.uid());

drop policy if exists "game_invites_update_host" on public.game_invites;
create policy "game_invites_update_host"
on public.game_invites for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

drop policy if exists "game_invites_delete_host_or_admin" on public.game_invites;
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

drop policy if exists "game_invite_participants_select_authenticated" on public.game_invite_participants;
create policy "game_invite_participants_select_authenticated"
on public.game_invite_participants for select
to authenticated
using (true);

drop policy if exists "game_invite_participants_insert_own" on public.game_invite_participants;
create policy "game_invite_participants_insert_own"
on public.game_invite_participants for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "game_invite_participants_delete_own" on public.game_invite_participants;
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

drop policy if exists "game_scores_select_authenticated" on public.game_scores;
create policy "game_scores_select_authenticated"
on public.game_scores for select
to authenticated
using (true);

drop policy if exists "game_scores_insert_own" on public.game_scores;
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

drop policy if exists "feedbacks_select_authenticated" on public.feedbacks;
create policy "feedbacks_select_authenticated"
on public.feedbacks for select
to authenticated
using (true);

drop policy if exists "feedbacks_insert_own" on public.feedbacks;
create policy "feedbacks_insert_own"
on public.feedbacks for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "feedbacks_update_moderator" on public.feedbacks;
create policy "feedbacks_update_moderator"
on public.feedbacks for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

drop policy if exists "feedbacks_delete_author_or_admin" on public.feedbacks;
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

drop policy if exists "feedback_votes_select_authenticated" on public.feedback_votes;
create policy "feedback_votes_select_authenticated"
on public.feedback_votes for select
to authenticated
using (true);

drop policy if exists "feedback_votes_insert_own" on public.feedback_votes;
create policy "feedback_votes_insert_own"
on public.feedback_votes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "feedback_votes_delete_own" on public.feedback_votes;
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

drop policy if exists "event_registrations_select_authenticated" on public.event_registrations;
create policy "event_registrations_select_authenticated"
on public.event_registrations for select
to authenticated
using (true);

drop policy if exists "event_registrations_insert_own" on public.event_registrations;
create policy "event_registrations_insert_own"
on public.event_registrations for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "event_registrations_delete_own_or_admin" on public.event_registrations;
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

drop trigger if exists on_user_levels_updated on public.user_levels;
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

drop trigger if exists on_auth_user_created_levels on auth.users;
create trigger on_auth_user_created_levels
  after insert on auth.users
  for each row execute procedure public.handle_new_user_levels();

insert into public.user_levels (user_id)
select id from auth.users
where id not in (select user_id from public.user_levels)
on conflict (user_id) do nothing;

alter table public.user_levels enable row level security;

drop policy if exists "user_levels_select_authenticated" on public.user_levels;
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


-- ============================================
-- 011: discord_roles table (Admin Dashboard)
-- ============================================

CREATE TABLE IF NOT EXISTS public.discord_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#99AAB5',
  discord_role_id TEXT DEFAULT NULL,
  permissions JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,
  is_synced BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.discord_roles ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_roles" on public.discord_roles;
CREATE POLICY "moderator_read_roles" ON public.discord_roles
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_manage_roles" on public.discord_roles;
CREATE POLICY "admin_manage_roles" ON public.discord_roles
  FOR ALL TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );


-- ============================================
-- 012: admin_audit_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_audit" on public.admin_audit_logs;
CREATE POLICY "moderator_read_audit" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — audit rows inserted via service_role only

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_logs (target_type, target_id);


-- ============================================
-- 013: pending_bot_actions queue
-- ============================================

CREATE TABLE IF NOT EXISTS public.pending_bot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.pending_bot_actions ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_pending" on public.pending_bot_actions;
CREATE POLICY "moderator_read_pending" ON public.pending_bot_actions
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — inserted via service_role only

drop policy if exists "admin_update_pending" on public.pending_bot_actions;
CREATE POLICY "admin_update_pending" ON public.pending_bot_actions
  FOR UPDATE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE INDEX IF NOT EXISTS idx_pending_status ON public.pending_bot_actions (status) WHERE status = 'pending';


-- ============================================
-- 014: tickets + ticket_replies
-- ============================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'request', 'report')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'discord')),
  discord_channel_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

drop policy if exists "read_tickets" on public.tickets;
CREATE POLICY "read_tickets" ON public.tickets
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "create_tickets" on public.tickets;
CREATE POLICY "create_tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

drop policy if exists "moderator_update_tickets" on public.tickets;
CREATE POLICY "moderator_update_tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_delete_tickets" on public.tickets;
CREATE POLICY "admin_delete_tickets" ON public.tickets
  FOR DELETE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

drop policy if exists "read_replies" on public.ticket_replies;
CREATE POLICY "read_replies" ON public.ticket_replies
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

drop policy if exists "create_replies" on public.ticket_replies;
CREATE POLICY "create_replies" ON public.ticket_replies
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.ticket_replies (ticket_id);


-- ============================================
-- 015: system_settings KV table
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_settings" on public.system_settings;
CREATE POLICY "moderator_read_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_manage_settings" on public.system_settings;
CREATE POLICY "admin_manage_settings" ON public.system_settings
  FOR ALL TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

INSERT INTO public.system_settings (key, value, description) VALUES
  ('discord_server_id', '"not_configured"', 'Bound Discord server ID'),
  ('allowed_roles', '["admin", "moderator"]', 'Roles allowed to access admin dashboard'),
  ('site_name', '"SUS LAB"', 'Website display name'),
  ('site_description', '"A creative community for gamers, musicians, artists, editors & developers"', 'Website description'),
  ('ticket_discord_channel', '"not_configured"', 'Discord channel ID for ticket source'),
  ('ticket_visible_roles', '["moderator", "admin"]', 'Roles that can view all tickets'),
  ('ticket_auto_categories', '["general", "bug", "request", "report"]', 'Available ticket categories'),
  ('notify_new_ticket', 'true', 'Send Discord webhook on new ticket'),
  ('notify_new_feedback', 'true', 'Send Discord webhook on new feedback'),
  ('notify_new_user', 'true', 'Send Discord webhook on new user join'),
  ('notification_webhook_url', '"not_configured"', 'Discord webhook URL for notifications')
ON CONFLICT (key) DO NOTHING;


-- ============================================
-- 018: servers + server_members tables for multi-server support
-- ============================================

CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id TEXT,
  settings JSONB NOT NULL DEFAULT '{
    "ticket_channels": [],
    "notification_webhook_url": "",
    "notify_new_ticket": true,
    "notify_new_feedback": true,
    "notify_new_user": true,
    "notify_ticket_status_change": true,
    "allowed_roles": [],
    "role_mapping": {}
  }',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS on_servers_updated ON public.servers;
CREATE TRIGGER on_servers_updated
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servers_select_member" ON public.servers;
CREATE POLICY "servers_select_member" ON public.servers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = id AND sm.user_id = auth.uid()
    )
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_roles TEXT[] NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members (user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON public.server_members (server_id);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server_members_select_own_server" ON public.server_members;
CREATE POLICY "server_members_select_own_server" ON public.server_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.server_members my
      WHERE my.server_id = server_id AND my.user_id = auth.uid()
    )
  );


-- ============================================
-- 019: Add server_id to existing server-scoped tables
-- ============================================

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_server
  ON public.user_roles (user_id, server_id)
  WHERE server_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_global
  ON public.user_roles (user_id)
  WHERE server_id IS NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tickets_server ON public.tickets (server_id);

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_feedbacks_server ON public.feedbacks (server_id);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_announcements_server ON public.announcements (server_id);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_events_server ON public.events (server_id);

ALTER TABLE public.discord_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_discord_roles_server ON public.discord_roles (server_id);

ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_server ON public.admin_audit_logs (server_id);

ALTER TABLE public.pending_bot_actions
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_server ON public.pending_bot_actions (server_id);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;


-- ============================================
-- 020: Backfill function to migrate existing data to multi-server schema
-- ============================================

CREATE OR REPLACE FUNCTION public.backfill_server_data(target_server_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  counts JSONB := '{}';
  affected INT;
BEGIN
  UPDATE public.user_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('user_roles', affected);

  UPDATE public.tickets SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('tickets', affected);

  UPDATE public.feedbacks SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('feedbacks', affected);

  UPDATE public.announcements SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('announcements', affected);

  UPDATE public.events SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('events', affected);

  UPDATE public.discord_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('discord_roles', affected);

  UPDATE public.admin_audit_logs SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('admin_audit_logs', affected);

  UPDATE public.pending_bot_actions SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('pending_bot_actions', affected);

  RETURN counts;
END;
$$;


-- ================================================================
-- DONE! All tables (001–020), triggers, functions, indexes, RLS,
-- and backfills have been created. This script is idempotent —
-- safe to run multiple times.
-- ================================================================
