-- ============================================
-- 002_rls_policies.sql
-- RLS policies for events and user_roles tables
-- ============================================

-- ---- events table ----

alter table public.events enable row level security;

-- SELECT: any authenticated user
create policy "events_select_authenticated"
on public.events for select
to authenticated
using (true);

-- INSERT: moderator or admin
create policy "events_insert_moderator"
on public.events for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- UPDATE: moderator or admin
create policy "events_update_moderator"
on public.events for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- DELETE: admin only
create policy "events_delete_admin"
on public.events for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ---- user_roles table ----

alter table public.user_roles enable row level security;

-- SELECT: own role or admin sees all
create policy "user_roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- UPDATE: admin only
create policy "user_roles_update_admin"
on public.user_roles for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- DELETE: admin only
create policy "user_roles_delete_admin"
on public.user_roles for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- No INSERT policy: deny by default.
-- Only the SECURITY DEFINER trigger can insert rows.
