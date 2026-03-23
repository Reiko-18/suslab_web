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
