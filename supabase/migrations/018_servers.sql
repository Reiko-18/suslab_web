-- 018: servers + server_members tables for multi-server support

CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id TEXT,
  settings JSONB NOT NULL DEFAULT '{
    "ticket_channels": [],
    "notification_webhook_url": "",
    "notify_new_ticket": true,
    "notify_new_feedback": true,
    "notify_new_user": true,
    "notify_ticket_status_change": true,
    "allowed_roles": [],
    "role_mapping": {}
  }',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS on_servers_updated ON public.servers;
CREATE TRIGGER on_servers_updated
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servers_select_member" ON public.servers;
CREATE POLICY "servers_select_member" ON public.servers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = id AND sm.user_id = auth.uid()
    )
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_roles TEXT[] NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members (user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON public.server_members (server_id);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server_members_select_own_server" ON public.server_members;
CREATE POLICY "server_members_select_own_server" ON public.server_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.server_members my
      WHERE my.server_id = server_id AND my.user_id = auth.uid()
    )
  );
