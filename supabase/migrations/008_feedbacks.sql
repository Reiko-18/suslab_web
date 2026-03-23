-- ============================================
-- 008_feedbacks.sql
-- feedbacks + feedback_votes tables + RLS
-- ============================================

-- 1. feedbacks table
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

-- SELECT: Any authenticated user
create policy "feedbacks_select_authenticated"
on public.feedbacks for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own author_id
create policy "feedbacks_insert_own"
on public.feedbacks for insert
to authenticated
with check (author_id = auth.uid());

-- UPDATE: Moderator+ (RLS grants row UPDATE; Edge Function restricts to status-only)
create policy "feedbacks_update_moderator"
on public.feedbacks for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- DELETE: Author or admin
create policy "feedbacks_delete_author_or_admin"
on public.feedbacks for delete
to authenticated
using (
  author_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 2. feedback_votes table
create table if not exists public.feedback_votes (
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (feedback_id, user_id)
);

alter table public.feedback_votes enable row level security;

-- SELECT: Any authenticated user
create policy "feedback_votes_select_authenticated"
on public.feedback_votes for select
to authenticated
using (true);

-- INSERT: Any authenticated user, must be own user_id
create policy "feedback_votes_insert_own"
on public.feedback_votes for insert
to authenticated
with check (user_id = auth.uid());

-- DELETE: Own vote only
create policy "feedback_votes_delete_own"
on public.feedback_votes for delete
to authenticated
using (user_id = auth.uid());
