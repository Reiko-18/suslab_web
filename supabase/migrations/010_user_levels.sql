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
