-- ============================================
-- 001b_events.sql
-- Creates events table (required by 002_rls_policies
-- and 009_event_registrations)
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

-- Auto-update updated_at trigger (reuses handle_updated_at from 001)
create trigger on_events_updated
  before update on public.events
  for each row execute procedure public.handle_updated_at();

-- Index for listing by date
create index idx_events_date on public.events (date asc);
