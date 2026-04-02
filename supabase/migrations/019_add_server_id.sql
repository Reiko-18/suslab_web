-- 019: Add server_id to existing server-scoped tables

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_server
  ON public.user_roles (user_id, server_id)
  WHERE server_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_global
  ON public.user_roles (user_id)
  WHERE server_id IS NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tickets_server ON public.tickets (server_id);

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_feedbacks_server ON public.feedbacks (server_id);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_announcements_server ON public.announcements (server_id);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_events_server ON public.events (server_id);

ALTER TABLE public.discord_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_discord_roles_server ON public.discord_roles (server_id);

ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_server ON public.admin_audit_logs (server_id);

ALTER TABLE public.pending_bot_actions
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_server ON public.pending_bot_actions (server_id);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;
