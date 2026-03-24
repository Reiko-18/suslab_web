-- supabase/migrations/011_discord_roles.sql
-- Discord roles table for role management (web + Discord sync)

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

-- Moderator+ can read roles
CREATE POLICY "moderator_read_roles" ON public.discord_roles
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- Admin can insert/update/delete roles
CREATE POLICY "admin_manage_roles" ON public.discord_roles
  FOR ALL USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );
