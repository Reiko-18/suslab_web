-- ============================================
-- 001_user_roles.sql
-- Creates user_roles table, triggers, and
-- custom access token hook
-- ============================================

-- 1. Create user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_user_id_unique unique (user_id)
);

-- 2. Auto-update updated_at trigger
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

-- 3. Auto-assign member role on signup
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

-- 4. Custom access token hook (injects role into JWT)
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

  -- Ensure app_metadata exists
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- Inject role (default to 'member' if not found)
  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(user_role, 'member'))
  );

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- 5. Grant permissions to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant all on table public.user_roles to supabase_auth_admin;

-- 6. Revoke direct access from public-facing roles
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- 7. Backfill: create member roles for existing users who don't have one
insert into public.user_roles (user_id, role)
select id, 'member' from auth.users
where id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;
