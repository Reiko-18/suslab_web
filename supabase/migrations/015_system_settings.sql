-- supabase/migrations/015_system_settings.sql
-- Key-value store for system configuration

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Moderator+ can read settings
CREATE POLICY "moderator_read_settings" ON public.system_settings
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- Admin can manage settings
CREATE POLICY "admin_manage_settings" ON public.system_settings
  FOR ALL USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

-- Insert default settings
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
