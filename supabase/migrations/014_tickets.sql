-- supabase/migrations/014_tickets.sql
-- Tickets system for support requests

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'request', 'report')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'discord')),
  discord_channel_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Members can read own tickets, moderator+ can read all
CREATE POLICY "read_tickets" ON public.tickets
  FOR SELECT USING (
    created_by = auth.uid()
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- Members can create tickets
CREATE POLICY "create_tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Moderator+ can update any ticket
CREATE POLICY "moderator_update_tickets" ON public.tickets
  FOR UPDATE USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- Admin can delete tickets
CREATE POLICY "admin_delete_tickets" ON public.tickets
  FOR DELETE USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

-- Replies: read if can read ticket
CREATE POLICY "read_replies" ON public.ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

-- Replies: members can create on own tickets, mod+ on any
CREATE POLICY "create_replies" ON public.ticket_replies
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

CREATE INDEX idx_tickets_status ON public.tickets (status);
CREATE INDEX idx_tickets_created_by ON public.tickets (created_by);
CREATE INDEX idx_ticket_replies_ticket ON public.ticket_replies (ticket_id);
