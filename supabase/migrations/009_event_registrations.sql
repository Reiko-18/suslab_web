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
