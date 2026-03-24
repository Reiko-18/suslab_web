-- ================================================================
-- SUSLAB WEB — Admin Dashboard Tables (011-015)
-- Run this in Supabase SQL Editor if you already have 001-010
-- ================================================================

-- ============================================
-- 011: discord_roles table
-- ============================================

CREATE TABLE IF NOT EXISTS public.discord_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#99AAB5',
  discord_role_id TEXT DEFAULT NULL,
  permissions JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,
  is_synced BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.discord_roles ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_roles" on public.discord_roles;
CREATE POLICY "moderator_read_roles" ON public.discord_roles
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_manage_roles" on public.discord_roles;
CREATE POLICY "admin_manage_roles" ON public.discord_roles
  FOR ALL TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );


-- ============================================
-- 012: admin_audit_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_audit" on public.admin_audit_logs;
CREATE POLICY "moderator_read_audit" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_logs (target_type, target_id);


-- ============================================
-- 013: pending_bot_actions queue
-- ============================================

CREATE TABLE IF NOT EXISTS public.pending_bot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.pending_bot_actions ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_pending" on public.pending_bot_actions;
CREATE POLICY "moderator_read_pending" ON public.pending_bot_actions
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_update_pending" on public.pending_bot_actions;
CREATE POLICY "admin_update_pending" ON public.pending_bot_actions
  FOR UPDATE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE INDEX IF NOT EXISTS idx_pending_status ON public.pending_bot_actions (status) WHERE status = 'pending';


-- ============================================
-- 014: tickets + ticket_replies
-- ============================================

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

drop policy if exists "read_tickets" on public.tickets;
CREATE POLICY "read_tickets" ON public.tickets
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "create_tickets" on public.tickets;
CREATE POLICY "create_tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

drop policy if exists "moderator_update_tickets" on public.tickets;
CREATE POLICY "moderator_update_tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_delete_tickets" on public.tickets;
CREATE POLICY "admin_delete_tickets" ON public.tickets
  FOR DELETE TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

drop policy if exists "read_replies" on public.ticket_replies;
CREATE POLICY "read_replies" ON public.ticket_replies
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

drop policy if exists "create_replies" on public.ticket_replies;
CREATE POLICY "create_replies" ON public.ticket_replies
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.created_by = auth.uid()
        OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin'))
    )
  );

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.ticket_replies (ticket_id);


-- ============================================
-- 015: system_settings KV table
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

drop policy if exists "moderator_read_settings" on public.system_settings;
CREATE POLICY "moderator_read_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

drop policy if exists "admin_manage_settings" on public.system_settings;
CREATE POLICY "admin_manage_settings" ON public.system_settings
  FOR ALL TO authenticated USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

INSERT INTO public.system_settings (key, value, description) VALUES
  ('discord_server_id', '"not_configured"', 'Bound Discord server ID'),
  ('allowed_roles', '["admin", "moderator"]', 'Roles allowed to access admin dashboard'),
  ('site_name', '"SUS LAB"', 'Website display name'),
  ('site_description', '"A creative community for gamers, musicians, artists, editors & developers"', 'Website description'),
  ('ticket_discord_channel', '"not_configured"', 'Discord channel ID for ticket source'),
  ('ticket_visible_roles', '["moderator", "admin"]', 'Roles that can view all tickets'),
  ('ticket_auto_categories', '["general", "bug", "request", "report"]', 'Available ticket categories'),
  ('notify_new_ticket', 'true', 'Send Discord webhook on new ticket'),
  ('notify_new_feedback', 'true', 'Send Discord webhook on new feedback'),
  ('notify_new_user', 'true', 'Send Discord webhook on new user join'),
  ('notification_webhook_url', '"not_configured"', 'Discord webhook URL for notifications')
ON CONFLICT (key) DO NOTHING;


-- ================================================================
-- DONE! Admin Dashboard tables (011-015) created.
-- Idempotent — safe to run multiple times.
-- ================================================================
