-- ============================================
-- 006_todos.sql
-- todos table, triggers, RLS
-- ============================================

-- 1. Create todos table
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

-- 2. Auto-update updated_at trigger (reuses existing handle_updated_at function from 001)
create trigger on_todos_updated
  before update on public.todos
  for each row execute procedure public.handle_updated_at();

-- 3. RLS
alter table public.todos enable row level security;

-- SELECT: Own todos OR public todos
create policy "todos_select_own_or_public"
on public.todos for select
to authenticated
using (
  user_id = auth.uid() or is_public = true
);

-- INSERT: Any authenticated user, must be own user_id
create policy "todos_insert_own"
on public.todos for insert
to authenticated
with check (user_id = auth.uid());

-- UPDATE: Creator or assignee
create policy "todos_update_creator_or_assignee"
on public.todos for update
to authenticated
using (
  user_id = auth.uid() or assigned_to = auth.uid()
)
with check (
  user_id = auth.uid() or assigned_to = auth.uid()
);

-- DELETE: Creator only
create policy "todos_delete_creator"
on public.todos for delete
to authenticated
using (user_id = auth.uid());
