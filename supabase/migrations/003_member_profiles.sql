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
