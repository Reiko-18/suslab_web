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
