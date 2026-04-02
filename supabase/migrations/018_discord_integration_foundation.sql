-- ============================================
-- 018_discord_integration_foundation.sql
-- Multi-guild Discord integration foundation
-- ============================================

-- Cache the user's Discord identity so server-side actions can map a Supabase user
-- to the corresponding Discord account without trusting client input.
ALTER TABLE public.member_profiles
ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS discord_username TEXT,
ADD COLUMN IF NOT EXISTS discord_global_name TEXT,
ADD COLUMN IF NOT EXISTS discord_avatar TEXT,
ADD COLUMN IF NOT EXISTS discord_locale TEXT;

-- Connected Discord guilds that are allowed to use the dashboard.
CREATE TABLE IF NOT EXISTS public.discord_guilds (
  guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  owner_discord_user_id TEXT,
  dashboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ticket_channel_id TEXT,
  ticket_forum_channel_id TEXT,
  allowed_role_ids TEXT[] NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.discord_guild_memberships (
  guild_id TEXT NOT NULL REFERENCES public.discord_guilds(guild_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  display_name TEXT,
  guild_avatar TEXT,
  role_ids TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_memberships_user
  ON public.discord_guild_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_discord_guild_memberships_discord_user
  ON public.discord_guild_memberships (discord_user_id);

ALTER TABLE public.discord_guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_guild_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderator_read_discord_guilds" ON public.discord_guilds;
CREATE POLICY "moderator_read_discord_guilds"
ON public.discord_guilds FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('moderator', 'admin')
);

DROP POLICY IF EXISTS "admin_manage_discord_guilds" ON public.discord_guilds;
CREATE POLICY "admin_manage_discord_guilds"
ON public.discord_guilds FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "self_or_mod_read_discord_memberships" ON public.discord_guild_memberships;
CREATE POLICY "self_or_mod_read_discord_memberships"
ON public.discord_guild_memberships FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('moderator', 'admin')
);

DROP POLICY IF EXISTS "admin_manage_discord_memberships" ON public.discord_guild_memberships;
CREATE POLICY "admin_manage_discord_memberships"
ON public.discord_guild_memberships FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

ALTER TABLE public.discord_roles
ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES public.discord_guilds(guild_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_roles_guild_name
  ON public.discord_roles (guild_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_roles_guild_discord_role_id
  ON public.discord_roles (guild_id, discord_role_id)
  WHERE discord_role_id IS NOT NULL;

ALTER TABLE public.pending_bot_actions
ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES public.discord_guilds(guild_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'dashboard';

CREATE INDEX IF NOT EXISTS idx_pending_status_guild
  ON public.pending_bot_actions (status, guild_id)
  WHERE status = 'pending';

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS guild_id TEXT REFERENCES public.discord_guilds(guild_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;

-- Seed a default placeholder guild row from legacy single-guild settings so existing
-- environments can migrate incrementally instead of breaking hard.
INSERT INTO public.discord_guilds (
  guild_id,
  name,
  ticket_channel_id,
  allowed_role_ids,
  created_by,
  settings,
  synced_at
)
SELECT
  trim(both '"' from server_setting.value::text),
  'Primary Discord Server',
  nullif(trim(both '"' from ticket_setting.value::text), 'not_configured'),
  ARRAY(
    SELECT jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(role_setting.value) = 'array' THEN role_setting.value
        ELSE '[]'::jsonb
      END
    )
  ),
  NULL,
  jsonb_build_object(
    'migrated_from_legacy_settings', true,
    'legacy_allowed_roles', role_setting.value
  ),
  now()
FROM public.system_settings server_setting
LEFT JOIN public.system_settings ticket_setting
  ON ticket_setting.key = 'ticket_discord_channel'
LEFT JOIN public.system_settings role_setting
  ON role_setting.key = 'allowed_roles'
WHERE server_setting.key = 'discord_server_id'
  AND trim(both '"' from server_setting.value::text) <> 'not_configured'
ON CONFLICT (guild_id) DO NOTHING;
