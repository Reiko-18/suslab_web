# Discord Bot & Multi-Server Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord.js bot with slash commands, multi-server schema, bidirectional ticket sync, and server-scoped permissions to the SusLab Web platform.

**Architecture:** Monorepo approach — bot lives in `bot/` directory, shared types in `shared/`. Database gains `servers` and `server_members` tables; existing tables get `server_id` columns. Bot connects to Discord gateway, processes slash commands, listens for ticket channel messages, and consumes `pending_bot_actions` via Supabase Realtime. Dashboard gets a server selector and per-server role resolution.

**Tech Stack:** Discord.js 14, Supabase JS v2, TypeScript 5, Vite 8, React 19, Deno (Edge Functions)

**Spec:** `docs/superpowers/specs/2026-04-02-discord-bot-multi-server-design.md`

---

## Phase 1: Multi-Server Schema & Migration

### Task 1.1: Create shared type definitions

**Files:**
- Create: `shared/types/database.ts`
- Create: `shared/types/roles.ts`

- [ ] **Step 1: Create `shared/types/roles.ts`**

```typescript
// shared/types/roles.ts
export type DashboardRole = 'member' | 'moderator' | 'admin'

export const ROLE_HIERARCHY: Record<DashboardRole, number> = {
  member: 1,
  moderator: 2,
  admin: 3,
} as const

export function hasMinimumRole(userRole: DashboardRole, minimumRole: DashboardRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0)
}
```

- [ ] **Step 2: Create `shared/types/database.ts`**

```typescript
// shared/types/database.ts
import type { DashboardRole } from './roles'

export interface Server {
  id: string
  discord_guild_id: string
  name: string
  icon_url: string | null
  owner_id: string | null
  settings: ServerSettings
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServerSettings {
  ticket_channels: string[]
  notification_webhook_url: string
  notify_new_ticket: boolean
  notify_new_feedback: boolean
  notify_new_user: boolean
  notify_ticket_status_change: boolean
  allowed_roles: string[]
  role_mapping: Record<string, DashboardRole>
}

export interface ServerMember {
  server_id: string
  user_id: string
  discord_roles: string[]
  joined_at: string
}

export type TicketCategory = 'general' | 'bug' | 'request' | 'report'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketSource = 'web' | 'discord'
export type FeedbackCategory = 'feature' | 'event' | 'bug'
export type FeedbackStatus = 'open' | 'reviewed' | 'accepted' | 'rejected'

export type BotActionType =
  | 'ban_user'
  | 'unban_user'
  | 'kick_user'
  | 'timeout_user'
  | 'sync_role'
  | 'send_message'
  | 'update_thread'

export interface BotAction {
  id: string
  action_type: BotActionType
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  server_id: string | null
  created_by: string | null
  created_at: string
  processed_at: string | null
}

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  ticket_channels: [],
  notification_webhook_url: '',
  notify_new_ticket: true,
  notify_new_feedback: true,
  notify_new_user: true,
  notify_ticket_status_change: true,
  allowed_roles: [],
  role_mapping: {},
}
```

- [ ] **Step 3: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["types/**/*.ts"]
}
```

- [ ] **Step 4: Commit**

```bash
git add shared/
git commit -m "feat: 新增 shared types 定義 (roles, database)"
```

---

### Task 1.2: Create migration 018 — `servers` and `server_members` tables

**Files:**
- Create: `supabase/migrations/018_servers.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 018: servers + server_members tables for multi-server support

-- Servers table
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

-- Authenticated users can see active servers they belong to (via server_members)
DROP POLICY IF EXISTS "servers_select_member" ON public.servers;
CREATE POLICY "servers_select_member" ON public.servers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = id AND sm.user_id = auth.uid()
    )
    OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

-- Only service_role inserts/updates servers (bot syncs them)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- Server members table
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

-- Only service_role manages server_members (bot syncs them)
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the contents of `supabase/migrations/018_servers.sql` and run in the Supabase SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_servers.sql
git commit -m "feat: 新增 servers 和 server_members 表 (migration 018)"
```

---

### Task 1.3: Create migration 019 — Add `server_id` to existing tables

**Files:**
- Create: `supabase/migrations/019_add_server_id.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 019: Add server_id to existing server-scoped tables
-- Strategy: Add nullable column, backfill will happen after first server is created

-- user_roles: make role per-server
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;

-- Drop the old unique constraint (user_id only) and add new one (user_id + server_id)
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

-- Allow same user to have different roles in different servers
-- But only one role per user per server
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_server
  ON public.user_roles (user_id, server_id)
  WHERE server_id IS NOT NULL;

-- Keep backward compat: one null server_id per user (for legacy/global role)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_global
  ON public.user_roles (user_id)
  WHERE server_id IS NULL;

-- tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tickets_server ON public.tickets (server_id);

-- feedbacks
ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_feedbacks_server ON public.feedbacks (server_id);

-- announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_announcements_server ON public.announcements (server_id);

-- events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_events_server ON public.events (server_id);

-- discord_roles
ALTER TABLE public.discord_roles
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_discord_roles_server ON public.discord_roles (server_id);

-- admin_audit_logs
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_server ON public.admin_audit_logs (server_id);

-- pending_bot_actions
ALTER TABLE public.pending_bot_actions
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_server ON public.pending_bot_actions (server_id);

-- tickets: add discord_message_id and discord_thread_id for sync
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_add_server_id.sql
git commit -m "feat: 為現有表新增 server_id 欄位 (migration 019)"
```

---

### Task 1.4: Create migration 020 — Data backfill function

**Files:**
- Create: `supabase/migrations/020_backfill_server.sql`

- [ ] **Step 1: Write migration SQL**

This creates a function that admins can call to backfill existing data after creating the first server. It reads the old `discord_server_id` from `system_settings`, creates a server row, and assigns all existing data to it.

```sql
-- 020: Backfill function to migrate existing data to multi-server schema
-- Run this AFTER the first server is created in the servers table.

CREATE OR REPLACE FUNCTION public.backfill_server_data(target_server_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  counts JSONB := '{}';
  affected INT;
BEGIN
  -- Backfill user_roles
  UPDATE public.user_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('user_roles', affected);

  -- Backfill tickets
  UPDATE public.tickets SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('tickets', affected);

  -- Backfill feedbacks
  UPDATE public.feedbacks SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('feedbacks', affected);

  -- Backfill announcements
  UPDATE public.announcements SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('announcements', affected);

  -- Backfill events
  UPDATE public.events SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('events', affected);

  -- Backfill discord_roles
  UPDATE public.discord_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('discord_roles', affected);

  -- Backfill admin_audit_logs
  UPDATE public.admin_audit_logs SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('admin_audit_logs', affected);

  -- Backfill pending_bot_actions
  UPDATE public.pending_bot_actions SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('pending_bot_actions', affected);

  RETURN counts;
END;
$$;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_backfill_server.sql
git commit -m "feat: 新增資料回填函數 backfill_server_data (migration 020)"
```

---

### Task 1.5: Update `SETUP_ALL.sql` with new tables

**Files:**
- Modify: `supabase/SETUP_ALL.sql` (append sections 018, 019, 020 at the end before the DONE comment)

- [ ] **Step 1: Append the three new migration contents to the end of SETUP_ALL.sql**

Add sections 018, 019, 020 before the final `-- DONE!` comment block. Copy the exact SQL from each migration file.

- [ ] **Step 2: Update the header comment**

Change `-- Order: 001 → 001b → 002 → ... → 010` to include `→ 018 → 019 → 020`

- [ ] **Step 3: Commit**

```bash
git add supabase/SETUP_ALL.sql
git commit -m "chore: 更新 SETUP_ALL.sql 包含多伺服器 schema"
```

---

### Task 1.6: Update `custom_access_token_hook` for per-server roles

**Files:**
- Create: `supabase/migrations/021_update_jwt_hook.sql`

- [ ] **Step 1: Write migration SQL**

The JWT hook needs to remain backward-compatible. It checks for a server-scoped role first, falls back to the global role.

```sql
-- 021: Update JWT hook to support per-server roles
-- The hook still sets a single role in the JWT.
-- The dashboard will pass server_id in requests to get server-scoped behavior.
-- The JWT role represents the user's "highest" role across all servers for RLS.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Get the highest role across all servers (or global role)
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid
  ORDER BY
    CASE role
      WHEN 'admin' THEN 3
      WHEN 'moderator' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;

  claims := event->'claims';

  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(user_role, 'member'))
  );

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/021_update_jwt_hook.sql
git commit -m "feat: 更新 JWT hook 支援多伺服器角色 (migration 021)"
```

---

## Phase 2: Permission Refactor & Server Selector

### Task 2.1: Create server management Edge Function

**Files:**
- Create: `supabase/functions/manage-servers/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/manage-servers/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await verifyAuth(req, 'member')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()

    // list: return servers the user belongs to, with their role in each
    if (action === 'list') {
      const { data: memberships, error: memErr } = await sc
        .from('server_members')
        .select('server_id, discord_roles, joined_at')
        .eq('user_id', user.id)

      if (memErr) return errorResponse(memErr.message, 500)

      const serverIds = (memberships ?? []).map(
        (m: { server_id: string }) => m.server_id
      )
      if (serverIds.length === 0) return jsonResponse([])

      const { data: servers, error: srvErr } = await sc
        .from('servers')
        .select('id, discord_guild_id, name, icon_url, is_active')
        .in('id', serverIds)
        .eq('is_active', true)

      if (srvErr) return errorResponse(srvErr.message, 500)

      // Get user's role per server
      const { data: roles } = await sc
        .from('user_roles')
        .select('server_id, role')
        .eq('user_id', user.id)
        .in('server_id', serverIds)

      const roleMap = new Map(
        (roles ?? []).map((r: { server_id: string; role: string }) => [
          r.server_id, r.role,
        ])
      )

      const result = (servers ?? []).map((s: Record<string, unknown>) => ({
        ...s,
        user_role: roleMap.get(s.id as string) ?? 'member',
      }))

      return jsonResponse(result)
    }

    // get-settings: return full settings for a server (admin only for that server)
    if (action === 'get-settings') {
      const { server_id } = body
      if (!server_id) return errorResponse('Missing server_id', 400)

      // Check user is admin in this server
      const { data: roleRow } = await sc
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('server_id', server_id)
        .single()

      if (roleRow?.role !== 'admin') {
        return errorResponse('Only server admin can view settings', 403)
      }

      const { data: server, error } = await sc
        .from('servers')
        .select('*')
        .eq('id', server_id)
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(server)
    }

    // update-settings: update server settings (admin only)
    if (action === 'update-settings') {
      const { server_id, settings } = body
      if (!server_id || !settings) return errorResponse('Missing server_id or settings', 400)

      const { data: roleRow } = await sc
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('server_id', server_id)
        .single()

      if (roleRow?.role !== 'admin') {
        return errorResponse('Only server admin can update settings', 403)
      }

      // Merge new settings with existing
      const { data: existing } = await sc
        .from('servers')
        .select('settings')
        .eq('id', server_id)
        .single()

      const merged = { ...(existing?.settings ?? {}), ...settings }

      const { data, error } = await sc
        .from('servers')
        .update({ settings: merged })
        .eq('id', server_id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Audit log
      const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'server_settings_update',
        target_type: 'server',
        target_id: server_id,
        details: { updated_keys: Object.keys(settings) },
        server_id,
      })

      return jsonResponse(data)
    }

    // get-role: get user's role in a specific server
    if (action === 'get-role') {
      const { server_id } = body
      if (!server_id) return errorResponse('Missing server_id', 400)

      // Check membership
      const { data: membership } = await sc
        .from('server_members')
        .select('discord_roles')
        .eq('user_id', user.id)
        .eq('server_id', server_id)
        .single()

      if (!membership) return errorResponse('Not a member of this server', 403)

      // Get explicit role
      const { data: roleRow } = await sc
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('server_id', server_id)
        .single()

      // If no explicit role, derive from role_mapping
      if (!roleRow) {
        const { data: server } = await sc
          .from('servers')
          .select('settings')
          .eq('id', server_id)
          .single()

        const mapping = (server?.settings as Record<string, unknown>)?.role_mapping as Record<string, string> | undefined
        if (mapping && membership.discord_roles) {
          const roleLevels: Record<string, number> = { member: 1, moderator: 2, admin: 3 }
          let highestRole = 'member'
          let highestLevel = 1
          for (const discordRoleId of membership.discord_roles) {
            const mapped = mapping[discordRoleId]
            if (mapped && (roleLevels[mapped] ?? 0) > highestLevel) {
              highestRole = mapped
              highestLevel = roleLevels[mapped] ?? 0
            }
          }
          return jsonResponse({ role: highestRole, source: 'mapping' })
        }
        return jsonResponse({ role: 'member', source: 'default' })
      }

      return jsonResponse({ role: roleRow.role, source: 'explicit' })
    }

    return errorResponse('Invalid action. Use: list, get-settings, update-settings, get-role', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/manage-servers/
git commit -m "feat: 新增 manage-servers Edge Function"
```

---

### Task 2.2: Update `_shared/auth.ts` for server-scoped verification

**Files:**
- Modify: `supabase/functions/_shared/auth.ts`

- [ ] **Step 1: Add `verifyAuthWithServer` function**

Add a new function alongside the existing `verifyAuth` (keep backward compat):

```typescript
export interface ServerAuthResult extends AuthResult {
  serverId: string
  serverRole: string
}

export async function verifyAuthWithServer(
  req: Request,
  minimumRole: string,
  serverId: string,
): Promise<ServerAuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw { message: 'Missing Authorization header', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: { user }, error } = await serviceClient.auth.getUser(token)
  if (error || !user) {
    throw { message: 'Invalid or expired token', status: 401 }
  }

  // Check membership in server
  const { data: membership } = await serviceClient
    .from('server_members')
    .select('discord_roles')
    .eq('user_id', user.id)
    .eq('server_id', serverId)
    .single()

  if (!membership) {
    throw { message: 'Not a member of this server', status: 403 }
  }

  // Get server-scoped role
  const { data: roleRow } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('server_id', serverId)
    .single()

  let serverRole = roleRow?.role ?? 'member'

  // If no explicit role, derive from role_mapping
  if (!roleRow) {
    const { data: server } = await serviceClient
      .from('servers')
      .select('settings')
      .eq('id', serverId)
      .single()

    const mapping = (server?.settings as Record<string, unknown>)?.role_mapping as Record<string, string> | undefined
    if (mapping && membership.discord_roles) {
      let highestLevel = 1
      for (const discordRoleId of membership.discord_roles) {
        const mapped = mapping[discordRoleId]
        const level = ROLE_LEVELS[mapped] ?? 0
        if (level > highestLevel) {
          serverRole = mapped
          highestLevel = level
        }
      }
    }
  }

  const userLevel = ROLE_LEVELS[serverRole] ?? 0
  const requiredLevel = ROLE_LEVELS[minimumRole] ?? 0

  if (userLevel < requiredLevel) {
    throw {
      message: `Insufficient permissions. Required: ${minimumRole}, current: ${serverRole}`,
      status: 403,
    }
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  return { user, role: serverRole, supabaseClient, serverId, serverRole }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/auth.ts
git commit -m "feat: 新增 verifyAuthWithServer 支援多伺服器權限驗證"
```

---

### Task 2.3: Update Edge Functions to accept `server_id`

**Files:**
- Modify: `supabase/functions/manage-tickets/index.ts`
- Modify: `supabase/functions/manage-feedbacks/index.ts` (same pattern)
- Modify: `supabase/functions/manage-events/index.ts` (same pattern)
- Modify: `supabase/functions/manage-announcements/index.ts` (same pattern)
- Modify: `supabase/functions/manage-roles/index.ts` (same pattern)
- Modify: `supabase/functions/manage-users/index.ts` (same pattern)
- Modify: `supabase/functions/admin-overview/index.ts` (same pattern)
- Modify: `supabase/functions/admin-settings/index.ts` (replace with manage-servers)

The pattern for each function:
1. Extract `server_id` from request body
2. If `server_id` is present, use `verifyAuthWithServer` instead of `verifyAuth`
3. Add `.eq('server_id', server_id)` to all queries
4. Include `server_id` in inserts

- [ ] **Step 1: Update `manage-tickets/index.ts`**

Replace the auth line and add server scoping. Key changes:

At the top of the try block:
```typescript
const body = await req.json()
const { action, server_id } = body

let user, role, supabaseClient
if (server_id) {
  const auth = await verifyAuthWithServer(req, 'member', server_id)
  user = auth.user; role = auth.serverRole; supabaseClient = auth.supabaseClient
} else {
  const auth = await verifyAuth(req, 'member')
  user = auth.user; role = auth.role; supabaseClient = auth.supabaseClient
}
```

In the `list` action, add:
```typescript
if (server_id) {
  query = query.eq('server_id', server_id)
}
```

In the `create` action, add `server_id` to the insert:
```typescript
.insert({
  title,
  content,
  category: category ?? 'general',
  priority: priority ?? 'normal',
  source: 'web',
  created_by: user.id,
  server_id: server_id ?? null,
})
```

In audit log inserts, add `server_id`:
```typescript
await sc.from('admin_audit_logs').insert({
  ...existingFields,
  server_id: server_id ?? null,
})
```

- [ ] **Step 2: Apply the same pattern to all other Edge Functions**

For each Edge Function:
- Import `verifyAuthWithServer` from `'../_shared/auth.ts'`
- Extract `server_id` from body
- Use conditional auth check
- Scope queries with `.eq('server_id', server_id)` when present
- Include `server_id` in inserts and audit logs

Files to update (same pattern as Step 1):
- `manage-feedbacks/index.ts`
- `manage-events/index.ts`
- `manage-announcements/index.ts`
- `manage-roles/index.ts`
- `manage-users/index.ts`
- `admin-overview/index.ts` (add server_id filter to all count queries)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "feat: Edge Functions 新增 server_id 範圍查詢支援"
```

---

### Task 2.4: Add `edgeFunctions` API for servers

**Files:**
- Modify: `src/services/edgeFunctions.ts`

- [ ] **Step 1: Add server-related API functions**

Add to the `edgeFunctions` object:

```typescript
// Servers
listServers: () => invoke('manage-servers', { action: 'list' }),

getServerSettings: (server_id: string) =>
  invoke('manage-servers', { action: 'get-settings', server_id }),

updateServerSettings: (server_id: string, settings: Record<string, unknown>) =>
  invoke('manage-servers', { action: 'update-settings', server_id, settings }),

getServerRole: (server_id: string) =>
  invoke('manage-servers', { action: 'get-role', server_id }),
```

- [ ] **Step 2: Update all existing functions to accept optional `server_id`**

Add `server_id?: string` parameter to all server-scoped functions and pass it in the invoke body. Example:

```typescript
listTickets: ({ page, pageSize, status, server_id }: TicketParams & { server_id?: string } = {}) =>
  invoke('manage-tickets', { action: 'list', page, pageSize, status, server_id }),
```

Apply to: `listTickets`, `createTicket`, `updateTicket`, `deleteTicket`, `replyTicket`, `getTicketReplies`, `listFeedbacks`, `createFeedback`, `voteFeedback`, `updateFeedbackStatus`, `deleteFeedback`, `getEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `getUsers`, `updateUserRole`, `banUser`, `unbanUser`, `kickUser`, `timeoutUser`, `getAuditLog`, `listRoles`, `createRole`, `updateRole`, `deleteRole`, `getAdminOverview`.

- [ ] **Step 3: Commit**

```bash
git add src/services/edgeFunctions.ts
git commit -m "feat: edgeFunctions 新增伺服器 API 與 server_id 參數"
```

---

### Task 2.5: Refactor AuthContext for multi-server

**Files:**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Update the AuthContextType interface**

```typescript
export interface ServerInfo {
  id: string
  discord_guild_id: string
  name: string
  icon_url: string | null
  user_role: Role
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  role: Role | null         // role in active server
  servers: ServerInfo[]
  activeServer: string | null  // server uuid
  loading: boolean
  hasRole: (minimumRole: Role) => boolean
  switchServer: (serverId: string) => Promise<void>
  signInWithDiscord: () => Promise<void>
  signOut: () => Promise<void>
}
```

- [ ] **Step 2: Add server state and loading logic**

```typescript
const [servers, setServers] = useState<ServerInfo[]>([])
const [activeServer, setActiveServer] = useState<string | null>(null)

// After auth state change sets the user, fetch servers
useEffect(() => {
  if (!user) {
    setServers([])
    setActiveServer(null)
    setRole(null)
    return
  }

  edgeFunctions.listServers().then((data: unknown) => {
    const serverList = data as ServerInfo[]
    setServers(serverList)

    // Restore last active server from localStorage, or pick first
    const savedServer = localStorage.getItem('suslab-active-server')
    const validSaved = serverList.find(s => s.id === savedServer)
    const target = validSaved ?? serverList[0] ?? null

    if (target) {
      setActiveServer(target.id)
      setRole(target.user_role as Role)
    }
  }).catch(() => {
    // If servers fail to load, fall back to JWT role
    setRole(user ? extractRole(user) : null)
  })
}, [user])
```

- [ ] **Step 3: Implement `switchServer`**

```typescript
const switchServer = async (serverId: string): Promise<void> => {
  const server = servers.find(s => s.id === serverId)
  if (!server) return
  setActiveServer(serverId)
  setRole(server.user_role as Role)
  localStorage.setItem('suslab-active-server', serverId)
}
```

- [ ] **Step 4: Update the provider value**

```typescript
<AuthContext.Provider value={{
  user, session, role, servers, activeServer, loading,
  hasRole, switchServer, signInWithDiscord, signOut
}}>
```

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "refactor: AuthContext 支援多伺服器切換與角色解析"
```

---

### Task 2.6: Add ServerSelector component

**Files:**
- Create: `src/components/ServerSelector.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'

export default function ServerSelector() {
  const { servers, activeServer, switchServer } = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const activeServerInfo = servers.find(s => s.id === activeServer)

  if (servers.length <= 1) return null // No selector needed for single server

  return (
    <div className="server-selector" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="server-selector-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: '8px',
          background: 'var(--md-sys-color-surface-container)',
          color: 'var(--md-sys-color-on-surface)',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        {activeServerInfo?.icon_url && (
          <img
            src={activeServerInfo.icon_url}
            alt=""
            style={{ width: 20, height: 20, borderRadius: '50%' }}
          />
        )}
        <span>{activeServerInfo?.name ?? t('nav.select_server')}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {open && (
        <div
          className="server-selector-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            minWidth: '200px',
            background: 'var(--md-sys-color-surface-container-high)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {servers.map(server => (
            <button
              key={server.id}
              onClick={() => { switchServer(server.id); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: server.id === activeServer
                  ? 'var(--md-sys-color-secondary-container)'
                  : 'transparent',
                color: server.id === activeServer
                  ? 'var(--md-sys-color-on-secondary-container)'
                  : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              {server.icon_url && (
                <img
                  src={server.icon_url}
                  alt=""
                  style={{ width: 24, height: 24, borderRadius: '50%' }}
                />
              )}
              <span>{server.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrate into TopAppBar**

Find the TopAppBar component and add `<ServerSelector />` next to the existing navigation elements.

- [ ] **Step 3: Commit**

```bash
git add src/components/ServerSelector.tsx
git commit -m "feat: 新增 ServerSelector 元件並整合至 TopAppBar"
```

---

### Task 2.7: Update all pages to pass `server_id` in API calls

**Files:**
- Modify: All pages that call `edgeFunctions.*` for server-scoped data

- [ ] **Step 1: Create a `useActiveServer` hook**

```typescript
// src/hooks/useActiveServer.ts
import { useAuth } from '../context/AuthContext'

export function useActiveServer(): string | undefined {
  const { activeServer } = useAuth()
  return activeServer ?? undefined
}
```

- [ ] **Step 2: Update each page to include `server_id` in API calls**

Pattern for each page (example with Tickets admin page):

```typescript
const serverId = useActiveServer()

// In data loading
useEffect(() => {
  if (!serverId) return
  edgeFunctions.listTickets({ status: tab, server_id: serverId })
    .then(setTickets)
    .catch(console.error)
}, [tab, serverId])
```

Apply to all pages that load server-scoped data:
- `src/pages/admin/Tickets.tsx`
- `src/pages/admin/FeedbackReview.tsx`
- `src/pages/admin/Users.tsx`
- `src/pages/admin/Roles.tsx`
- `src/pages/admin/Overview.tsx`
- `src/pages/admin/Settings.tsx` (replace with server settings)
- `src/pages/Feedback.tsx`
- `src/pages/Events.tsx`
- `src/pages/Announcements.tsx`
- `src/pages/Home.tsx` (stats)

- [ ] **Step 3: Commit**

```bash
git add src/pages/ src/hooks/useActiveServer.ts
git commit -m "feat: 所有頁面加入 server_id 範圍查詢"
```

---

### Task 2.8: Update admin Settings page for per-server config

**Files:**
- Modify: `src/pages/admin/Settings.tsx`

- [ ] **Step 1: Replace global system_settings with server settings**

The Settings page should now:
1. Load settings from `edgeFunctions.getServerSettings(serverId)` instead of `edgeFunctions.listSettings()`
2. Display the `servers.settings` JSONB fields organized by group
3. Save via `edgeFunctions.updateServerSettings(serverId, changes)`

Setting groups:
- **Server**: name, discord_guild_id (read-only)
- **Tickets**: ticket_channels (array of channel IDs)
- **Notifications**: notification_webhook_url, notify_new_ticket, notify_new_feedback, notify_new_user, notify_ticket_status_change
- **Access**: allowed_roles, role_mapping (Discord role ID → dashboard role)

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/Settings.tsx
git commit -m "refactor: Settings 頁面改為 per-server 設定"
```

---

### Task 2.9: Update member visibility UI

**Files:**
- Modify: `src/pages/Profile.tsx` (or the profile edit component)

- [ ] **Step 1: Add visibility controls to profile edit**

Add a "Visibility" section with:
- Preset dropdown: Public, Members Only, Private, Custom
- Field toggle grid (one toggle per field: bio, skill_tags, social_links, email, discord_id, xp_level, badges)
- When preset selected → set all toggles accordingly
- When individual toggle changed → preset becomes "custom"

```typescript
const PRESETS: Record<string, Record<string, boolean>> = {
  public: { bio: true, skill_tags: true, social_links: true, email: true, discord_id: true, xp_level: true, badges: true, joined_servers: true },
  members_only: { bio: true, skill_tags: true, social_links: true, email: false, discord_id: true, xp_level: true, badges: true, joined_servers: false },
  private: { bio: false, skill_tags: false, social_links: false, email: false, discord_id: false, xp_level: false, badges: false, joined_servers: false },
}

function applyPreset(presetName: string) {
  const fields = PRESETS[presetName]
  if (fields) {
    setVisibility({ preset: presetName, fields })
  }
}

function toggleField(field: string) {
  setVisibility(prev => ({
    preset: 'custom',
    fields: { ...prev.fields, [field]: !prev.fields[field] },
  }))
}
```

- [ ] **Step 2: Update profile view to respect visibility**

When viewing another member's profile, the Edge Function should filter fields based on visibility. Update `get-members` and `manage-profile` to:
- If viewer is the profile owner → show all fields
- If `preset === 'private'` → name and avatar only
- If `preset === 'members_only'` → check if viewer shares a server with owner
- Otherwise → filter by `fields` object

- [ ] **Step 3: Commit**

```bash
git add src/pages/Profile.tsx src/components/
git commit -m "feat: 個人資料可見度控制 (預設 + 欄位級別)"
```

---

## Phase 3: Discord.js Bot Core

### Task 3.1: Initialize bot project

**Files:**
- Create: `bot/package.json`
- Create: `bot/tsconfig.json`
- Create: `bot/.env.example`

- [ ] **Step 1: Create `bot/package.json`**

```json
{
  "name": "suslab-discord-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "register": "tsx src/commands/register.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.99.3",
    "discord.js": "^14.18.0",
    "dotenv": "^16.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `bot/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create `bot/.env.example`**

```
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Install dependencies**

```bash
cd bot && npm install
```

- [ ] **Step 5: Commit**

```bash
git add bot/package.json bot/tsconfig.json bot/.env.example
echo "bot/node_modules/" >> .gitignore
git add .gitignore
git commit -m "feat: 初始化 Discord bot 專案結構"
```

---

### Task 3.2: Create bot entry point and config

**Files:**
- Create: `bot/src/index.ts`
- Create: `bot/src/config.ts`
- Create: `bot/src/services/supabase.ts`

- [ ] **Step 1: Create `bot/src/config.ts`**

```typescript
import 'dotenv/config'

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN ?? '',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
} as const

// Validate required env vars at startup
for (const [key, value] of Object.entries(config.discord)) {
  if (!value) throw new Error(`Missing env var: DISCORD_${key.toUpperCase()}`)
}
for (const [key, value] of Object.entries(config.supabase)) {
  if (!value) throw new Error(`Missing env var: SUPABASE_${key.toUpperCase()}`)
}
```

- [ ] **Step 2: Create `bot/src/services/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
)
```

- [ ] **Step 3: Create `bot/src/index.ts`**

```typescript
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { supabase } from './services/supabase.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  console.log(`Serving ${c.guilds.cache.size} guilds`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

client.login(config.discord.token)
```

- [ ] **Step 4: Test bot starts**

```bash
cd bot && npm run dev
```

Expected: "Bot ready as <bot_name>" in console.

- [ ] **Step 5: Commit**

```bash
git add bot/src/
git commit -m "feat: Discord bot 入口點與設定"
```

---

### Task 3.3: Guild sync — auto-register servers and members

**Files:**
- Create: `bot/src/services/guildSync.ts`
- Create: `bot/src/listeners/guildMemberAdd.ts`
- Create: `bot/src/listeners/guildMemberRemove.ts`

- [ ] **Step 1: Create `bot/src/services/guildSync.ts`**

```typescript
import { Client, Guild, GuildMember } from 'discord.js'
import { supabase } from './supabase.js'

export async function syncGuild(guild: Guild): Promise<string> {
  // Upsert server
  const { data, error } = await supabase
    .from('servers')
    .upsert(
      {
        discord_guild_id: guild.id,
        name: guild.name,
        icon_url: guild.iconURL({ size: 128 }),
        owner_id: guild.ownerId,
      },
      { onConflict: 'discord_guild_id' }
    )
    .select('id')
    .single()

  if (error) throw new Error(`Failed to sync guild ${guild.name}: ${error.message}`)
  return data.id
}

export async function syncMember(
  serverId: string,
  member: GuildMember,
): Promise<void> {
  const discordRoles = member.roles.cache
    .filter(r => r.id !== member.guild.id) // exclude @everyone
    .map(r => r.id)

  await supabase.from('server_members').upsert(
    {
      server_id: serverId,
      user_id: await resolveUserId(member.id),
      discord_roles: discordRoles,
    },
    { onConflict: 'server_id,user_id' }
  )
}

export async function removeMember(
  serverId: string,
  discordUserId: string,
): Promise<void> {
  const userId = await resolveUserId(discordUserId)
  if (!userId) return

  await supabase
    .from('server_members')
    .delete()
    .eq('server_id', serverId)
    .eq('user_id', userId)
}

export async function syncAllMembers(
  serverId: string,
  guild: Guild,
): Promise<number> {
  const members = await guild.members.fetch()
  let synced = 0

  for (const [, member] of members) {
    if (member.user.bot) continue
    try {
      await syncMember(serverId, member)
      synced++
    } catch {
      console.warn(`Failed to sync member ${member.user.tag}`)
    }
  }
  return synced
}

// Resolve Discord user ID to Supabase auth user ID
// This works because Discord OAuth stores the provider ID in identities
async function resolveUserId(discordUserId: string): Promise<string | null> {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users?.find(u =>
    u.identities?.some(i => i.provider === 'discord' && i.id === discordUserId)
  )
  return user?.id ?? null
}

export async function fullSync(client: Client): Promise<void> {
  console.log('Starting full guild sync...')
  for (const [, guild] of client.guilds.cache) {
    try {
      const serverId = await syncGuild(guild)
      const count = await syncAllMembers(serverId, guild)
      console.log(`Synced guild "${guild.name}": ${count} members`)
    } catch (err) {
      console.error(`Failed to sync guild ${guild.name}:`, err)
    }
  }
  console.log('Full sync complete')
}
```

- [ ] **Step 2: Create `bot/src/listeners/guildMemberAdd.ts`**

```typescript
import { Events, GuildMember } from 'discord.js'
import type { Client } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { syncMember } from '../services/guildSync.js'

export function registerGuildMemberAdd(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (member.user.bot) return

    try {
      // Find server ID
      const { data: server } = await supabase
        .from('servers')
        .select('id, settings')
        .eq('discord_guild_id', member.guild.id)
        .single()

      if (!server) return

      await syncMember(server.id, member)
      console.log(`Member joined: ${member.user.tag} in ${member.guild.name}`)

      // Send webhook notification if configured
      const settings = server.settings as Record<string, unknown>
      if (settings.notify_new_user && settings.notification_webhook_url) {
        const webhookUrl = settings.notification_webhook_url as string
        if (webhookUrl && webhookUrl !== 'not_configured') {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: 'New Member Joined',
                description: `${member.user.tag} joined the server`,
                color: 0x7C9070,
                thumbnail: { url: member.user.displayAvatarURL() },
                timestamp: new Date().toISOString(),
              }],
            }),
          })
        }
      }
    } catch (err) {
      console.error('Error handling member join:', err)
    }
  })
}
```

- [ ] **Step 3: Create `bot/src/listeners/guildMemberRemove.ts`**

```typescript
import { Events, GuildMember, PartialGuildMember } from 'discord.js'
import type { Client } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { removeMember } from '../services/guildSync.js'

export function registerGuildMemberRemove(client: Client): void {
  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    if (member.user.bot) return

    try {
      const { data: server } = await supabase
        .from('servers')
        .select('id')
        .eq('discord_guild_id', member.guild.id)
        .single()

      if (!server) return

      await removeMember(server.id, member.user.id)
      console.log(`Member left: ${member.user.tag} from ${member.guild.name}`)
    } catch (err) {
      console.error('Error handling member remove:', err)
    }
  })
}
```

- [ ] **Step 4: Wire listeners into `bot/src/index.ts`**

Add to `index.ts` after the `client` declaration:

```typescript
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'

registerGuildMemberAdd(client)
registerGuildMemberRemove(client)

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  await fullSync(client)
})
```

- [ ] **Step 5: Commit**

```bash
git add bot/src/
git commit -m "feat: Guild 同步 — 自動同步伺服器與成員到資料庫"
```

---

### Task 3.4: Slash command registration

**Files:**
- Create: `bot/src/commands/register.ts`
- Create: `bot/src/commands/definitions.ts`

- [ ] **Step 1: Create `bot/src/commands/definitions.ts`**

```typescript
import { SlashCommandBuilder } from 'discord.js'

export const commands = [
  // Member: /ticket
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new ticket')
        .addStringOption(o => o.setName('title').setDescription('Ticket title').setRequired(true))
        .addStringOption(o => o.setName('category').setDescription('Category')
          .addChoices(
            { name: 'General', value: 'general' },
            { name: 'Bug', value: 'bug' },
            { name: 'Request', value: 'request' },
            { name: 'Report', value: 'report' },
          ))
        .addStringOption(o => o.setName('priority').setDescription('Priority')
          .addChoices(
            { name: 'Low', value: 'low' },
            { name: 'Normal', value: 'normal' },
            { name: 'High', value: 'high' },
            { name: 'Urgent', value: 'urgent' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check a ticket status')
        .addStringOption(o => o.setName('ticket-id').setDescription('Ticket ID'))
    )
    .addSubcommand(sub =>
      sub.setName('reply')
        .setDescription('Reply to a ticket')
        .addStringOption(o => o.setName('ticket-id').setDescription('Ticket ID').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Reply message').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close a ticket')
        .addStringOption(o => o.setName('ticket-id').setDescription('Ticket ID').setRequired(true))
    ),

  // Member: /feedback
  new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Submit and manage feedback')
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Submit new feedback')
        .addStringOption(o => o.setName('category').setDescription('Category').setRequired(true)
          .addChoices(
            { name: 'Feature', value: 'feature' },
            { name: 'Event', value: 'event' },
            { name: 'Bug', value: 'bug' },
          ))
        .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List recent feedback')
        .addStringOption(o => o.setName('category').setDescription('Filter by category')
          .addChoices(
            { name: 'Feature', value: 'feature' },
            { name: 'Event', value: 'event' },
            { name: 'Bug', value: 'bug' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('vote')
        .setDescription('Upvote feedback')
        .addStringOption(o => o.setName('feedback-id').setDescription('Feedback ID').setRequired(true))
    ),

  // Member: /profile
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View and edit profiles')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a member profile')
        .addUserOption(o => o.setName('user').setDescription('User to view (default: yourself)'))
    )
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit your profile')
    ),

  // Member: /event
  new SlashCommandBuilder()
    .setName('event')
    .setDescription('View and join events')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List upcoming events')
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join an event')
        .addStringOption(o => o.setName('event-id').setDescription('Event ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Leave an event')
        .addStringOption(o => o.setName('event-id').setDescription('Event ID').setRequired(true))
    ),

  // Moderator: /mod
  new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderator commands')
    .setDefaultMemberPermissions(0) // Hidden by default, use Discord permissions
    .addSubcommand(sub =>
      sub.setName('ticket-status')
        .setDescription('Change ticket status')
        .addStringOption(o => o.setName('ticket-id').setDescription('Ticket ID').setRequired(true))
        .addStringOption(o => o.setName('status').setDescription('New status').setRequired(true)
          .addChoices(
            { name: 'Open', value: 'open' },
            { name: 'In Progress', value: 'in_progress' },
            { name: 'Resolved', value: 'resolved' },
            { name: 'Closed', value: 'closed' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('ticket-assign')
        .setDescription('Assign a ticket')
        .addStringOption(o => o.setName('ticket-id').setDescription('Ticket ID').setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Assign to').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('feedback-review')
        .setDescription('Review feedback')
        .addStringOption(o => o.setName('feedback-id').setDescription('Feedback ID').setRequired(true))
        .addStringOption(o => o.setName('status').setDescription('New status').setRequired(true)
          .addChoices(
            { name: 'Reviewed', value: 'reviewed' },
            { name: 'Accepted', value: 'accepted' },
            { name: 'Rejected', value: 'rejected' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('warn')
        .setDescription('Warn a user')
        .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('timeout')
        .setDescription('Timeout a user')
        .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Kick a user')
        .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
    ),
]
```

- [ ] **Step 2: Create `bot/src/commands/register.ts`**

```typescript
import { REST, Routes } from 'discord.js'
import { config } from '../config.js'
import { commands } from './definitions.js'

const rest = new REST().setToken(config.discord.token)

async function registerCommands() {
  try {
    console.log(`Registering ${commands.length} slash commands...`)

    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands.map(c => c.toJSON()) },
    )

    console.log('Slash commands registered successfully!')
  } catch (error) {
    console.error('Failed to register commands:', error)
  }
}

registerCommands()
```

- [ ] **Step 3: Register commands**

```bash
cd bot && npm run register
```

Expected: "Slash commands registered successfully!"

- [ ] **Step 4: Commit**

```bash
git add bot/src/commands/
git commit -m "feat: Discord slash command 定義與註冊"
```

---

### Task 3.5: Implement slash command handlers

**Files:**
- Create: `bot/src/commands/ticket.ts`
- Create: `bot/src/commands/feedback.ts`
- Create: `bot/src/commands/profile.ts`
- Create: `bot/src/commands/event.ts`
- Create: `bot/src/commands/mod.ts`
- Create: `bot/src/commands/handler.ts`

- [ ] **Step 1: Create `bot/src/services/discord.ts` — helper to resolve Discord ↔ Supabase user**

```typescript
import { supabase } from './supabase.js'

export async function resolveSupabaseUserId(discordUserId: string): Promise<string | null> {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users?.find(u =>
    u.identities?.some(i => i.provider === 'discord' && i.id === discordUserId)
  )
  return user?.id ?? null
}

export async function getServerIdFromGuild(guildId: string): Promise<string | null> {
  const { data } = await supabase
    .from('servers')
    .select('id')
    .eq('discord_guild_id', guildId)
    .single()
  return data?.id ?? null
}

export async function getUserRoleInServer(userId: string, serverId: string): Promise<string> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('server_id', serverId)
    .single()
  return data?.role ?? 'member'
}
```

- [ ] **Step 2: Create `bot/src/commands/handler.ts`**

```typescript
import { Events, ChatInputCommandInteraction } from 'discord.js'
import type { Client } from 'discord.js'
import { handleTicketCommand } from './ticket.js'
import { handleFeedbackCommand } from './feedback.js'
import { handleProfileCommand } from './profile.js'
import { handleEventCommand } from './event.js'
import { handleModCommand } from './mod.js'

export function registerCommandHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    const cmd = interaction as ChatInputCommandInteraction

    try {
      switch (cmd.commandName) {
        case 'ticket': await handleTicketCommand(cmd); break
        case 'feedback': await handleFeedbackCommand(cmd); break
        case 'profile': await handleProfileCommand(cmd); break
        case 'event': await handleEventCommand(cmd); break
        case 'mod': await handleModCommand(cmd); break
        default:
          await cmd.reply({ content: 'Unknown command', ephemeral: true })
      }
    } catch (err) {
      console.error(`Command error (${cmd.commandName}):`, err)
      const msg = 'An error occurred processing your command.'
      if (cmd.replied || cmd.deferred) {
        await cmd.followUp({ content: msg, ephemeral: true })
      } else {
        await cmd.reply({ content: msg, ephemeral: true })
      }
    }
  })
}
```

- [ ] **Step 3: Create `bot/src/commands/ticket.ts`**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

export async function handleTicketCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  const sub = cmd.options.getSubcommand()
  const userId = await resolveSupabaseUserId(cmd.user.id)
  const serverId = cmd.guildId ? await getServerIdFromGuild(cmd.guildId) : null

  if (!userId) {
    await cmd.reply({ content: 'You must log in to the dashboard first to link your account.', ephemeral: true })
    return
  }

  if (sub === 'create') {
    const title = cmd.options.getString('title', true)
    const category = cmd.options.getString('category') ?? 'general'
    const priority = cmd.options.getString('priority') ?? 'normal'

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title,
        content: title, // Discord command uses title as content
        category,
        priority,
        source: 'discord',
        created_by: userId,
        server_id: serverId,
        discord_channel_id: cmd.channelId,
      })
      .select('id')
      .single()

    if (error) {
      await cmd.reply({ content: `Failed to create ticket: ${error.message}`, ephemeral: true })
      return
    }

    // Create a thread for this ticket
    if (cmd.channel && cmd.channel.type === ChannelType.GuildText) {
      const thread = await cmd.channel.threads.create({
        name: `Ticket #${data.id.slice(0, 8)}: ${title.slice(0, 50)}`,
        autoArchiveDuration: 10080, // 7 days
      })
      await supabase.from('tickets').update({ discord_thread_id: thread.id }).eq('id', data.id)
      await thread.send(`Ticket created by ${cmd.user.tag}\n**Category:** ${category}\n**Priority:** ${priority}`)
    }

    const embed = new EmbedBuilder()
      .setTitle('Ticket Created')
      .setDescription(`**${title}**`)
      .addFields(
        { name: 'ID', value: data.id.slice(0, 8), inline: true },
        { name: 'Category', value: category, inline: true },
        { name: 'Priority', value: priority, inline: true },
      )
      .setColor(0x7C9070)
      .setTimestamp()

    await cmd.reply({ embeds: [embed] })
    return
  }

  if (sub === 'status') {
    const ticketId = cmd.options.getString('ticket-id')

    let query = supabase.from('tickets').select('*').eq('created_by', userId)
    if (ticketId) {
      query = query.ilike('id', `${ticketId}%`)
    }
    query = query.order('created_at', { ascending: false }).limit(5)

    const { data, error } = await query
    if (error || !data?.length) {
      await cmd.reply({ content: 'No tickets found.', ephemeral: true })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle('Your Tickets')
      .setColor(0x7C9070)

    for (const t of data) {
      embed.addFields({
        name: `#${(t.id as string).slice(0, 8)} — ${t.title as string}`,
        value: `Status: **${t.status as string}** | Priority: ${t.priority as string}`,
      })
    }

    await cmd.reply({ embeds: [embed], ephemeral: true })
    return
  }

  if (sub === 'reply') {
    const ticketId = cmd.options.getString('ticket-id', true)
    const message = cmd.options.getString('message', true)

    // Find ticket by prefix match
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, discord_thread_id')
      .eq('created_by', userId)
      .ilike('id', `${ticketId}%`)
      .single()

    if (!ticket) {
      await cmd.reply({ content: 'Ticket not found.', ephemeral: true })
      return
    }

    await supabase.from('ticket_replies').insert({
      ticket_id: ticket.id,
      content: message,
      author_id: userId,
    })

    await cmd.reply({ content: `Reply added to ticket #${ticketId}`, ephemeral: true })
    return
  }

  if (sub === 'close') {
    const ticketId = cmd.options.getString('ticket-id', true)

    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .eq('created_by', userId)
      .ilike('id', `${ticketId}%`)
      .single()

    if (!ticket) {
      await cmd.reply({ content: 'Ticket not found or not yours.', ephemeral: true })
      return
    }

    await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticket.id)
    await cmd.reply({ content: `Ticket #${ticketId} closed.`, ephemeral: true })
    return
  }
}
```

- [ ] **Step 4: Create `bot/src/commands/feedback.ts`**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

export async function handleFeedbackCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  const sub = cmd.options.getSubcommand()
  const userId = await resolveSupabaseUserId(cmd.user.id)
  const serverId = cmd.guildId ? await getServerIdFromGuild(cmd.guildId) : null

  if (!userId) {
    await cmd.reply({ content: 'You must log in to the dashboard first.', ephemeral: true })
    return
  }

  if (sub === 'submit') {
    const category = cmd.options.getString('category', true)
    const title = cmd.options.getString('title', true)
    const description = cmd.options.getString('description', true)

    const { data, error } = await supabase.from('feedbacks').insert({
      author_id: userId,
      category,
      title,
      content: description,
      server_id: serverId,
    }).select('id').single()

    if (error) {
      await cmd.reply({ content: `Failed: ${error.message}`, ephemeral: true })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle('Feedback Submitted')
      .addFields(
        { name: 'Title', value: title },
        { name: 'Category', value: category, inline: true },
        { name: 'ID', value: data.id.slice(0, 8), inline: true },
      )
      .setColor(0x7C9070)
      .setTimestamp()

    await cmd.reply({ embeds: [embed] })
    return
  }

  if (sub === 'list') {
    const category = cmd.options.getString('category')
    let query = supabase.from('feedbacks').select('id, title, category, status, vote_count')
      .order('vote_count', { ascending: false }).limit(10)

    if (serverId) query = query.eq('server_id', serverId)
    if (category) query = query.eq('category', category)

    const { data } = await query
    if (!data?.length) {
      await cmd.reply({ content: 'No feedback found.', ephemeral: true })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle('Recent Feedback')
      .setColor(0x7C9070)

    for (const f of data) {
      embed.addFields({
        name: `#${(f.id as string).slice(0, 8)} [${f.category}] ${f.title}`,
        value: `Status: ${f.status} | Votes: ${f.vote_count}`,
      })
    }

    await cmd.reply({ embeds: [embed], ephemeral: true })
    return
  }

  if (sub === 'vote') {
    const feedbackId = cmd.options.getString('feedback-id', true)

    const { data: feedback } = await supabase.from('feedbacks')
      .select('id').ilike('id', `${feedbackId}%`).single()

    if (!feedback) {
      await cmd.reply({ content: 'Feedback not found.', ephemeral: true })
      return
    }

    // Check if already voted
    const { data: existing } = await supabase.from('feedback_votes')
      .select('feedback_id').eq('feedback_id', feedback.id).eq('user_id', userId).single()

    if (existing) {
      await cmd.reply({ content: 'You already voted on this.', ephemeral: true })
      return
    }

    await supabase.from('feedback_votes').insert({ feedback_id: feedback.id, user_id: userId })
    await supabase.from('feedbacks').update({ vote_count: supabase.rpc ? undefined : 0 }).eq('id', feedback.id)
    // Increment vote_count
    await supabase.rpc('', {}) // Use raw SQL update instead:
    const { error } = await supabase.from('feedbacks')
      .update({ vote_count: (await supabase.from('feedbacks').select('vote_count').eq('id', feedback.id).single()).data?.vote_count + 1 })
      .eq('id', feedback.id)

    await cmd.reply({ content: `Voted on feedback #${feedbackId}!`, ephemeral: true })
    return
  }
}
```

Note: The vote_count increment should use a Postgres function for atomicity. Create an RPC if not already present:

```sql
-- Add to a migration if needed
CREATE OR REPLACE FUNCTION public.increment_vote_count(feedback_uuid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.feedbacks SET vote_count = vote_count + 1 WHERE id = feedback_uuid;
END;
$$;
```

Then in the bot: `await supabase.rpc('increment_vote_count', { feedback_uuid: feedback.id })`

- [ ] **Step 5: Create `bot/src/commands/profile.ts`**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId } from '../services/discord.js'

export async function handleProfileCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  const sub = cmd.options.getSubcommand()

  if (sub === 'view') {
    const targetUser = cmd.options.getUser('user') ?? cmd.user
    const userId = await resolveSupabaseUserId(targetUser.id)

    if (!userId) {
      await cmd.reply({ content: 'User not found in dashboard.', ephemeral: true })
      return
    }

    const { data: profile } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      await cmd.reply({ content: 'Profile not found.', ephemeral: true })
      return
    }

    // Check visibility
    const visibility = (profile.visibility as { preset?: string; fields?: Record<string, boolean> }) ?? {}
    const isOwn = targetUser.id === cmd.user.id

    if (!isOwn && visibility.preset === 'private') {
      const embed = new EmbedBuilder()
        .setTitle(targetUser.displayName)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription('This profile is private.')
        .setColor(0x7C9070)
      await cmd.reply({ embeds: [embed], ephemeral: true })
      return
    }

    const fields = visibility.fields ?? {}
    const embed = new EmbedBuilder()
      .setTitle(targetUser.displayName)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(0x7C9070)

    if (isOwn || fields.bio !== false) {
      embed.setDescription((profile.bio as string) || 'No bio set')
    }
    if (isOwn || fields.skill_tags !== false) {
      const tags = (profile.skill_tags as string[]) ?? []
      if (tags.length) embed.addFields({ name: 'Skills', value: tags.join(', ') })
    }
    if (isOwn || fields.social_links !== false) {
      const links = profile.social_links as Record<string, string> ?? {}
      const linkStr = Object.entries(links).map(([k, v]) => `${k}: ${v}`).join('\n')
      if (linkStr) embed.addFields({ name: 'Social Links', value: linkStr })
    }

    await cmd.reply({ embeds: [embed], ephemeral: true })
    return
  }

  if (sub === 'edit') {
    const modal = new ModalBuilder()
      .setCustomId('profile-edit-modal')
      .setTitle('Edit Profile')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('bio')
            .setLabel('Bio')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('skill_tags')
            .setLabel('Skill Tags (comma-separated)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
      )

    await cmd.showModal(modal)
    return
  }
}
```

- [ ] **Step 6: Create `bot/src/commands/event.ts`**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

export async function handleEventCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  const sub = cmd.options.getSubcommand()
  const userId = await resolveSupabaseUserId(cmd.user.id)
  const serverId = cmd.guildId ? await getServerIdFromGuild(cmd.guildId) : null

  if (!userId) {
    await cmd.reply({ content: 'You must log in to the dashboard first.', ephemeral: true })
    return
  }

  if (sub === 'list') {
    let query = supabase.from('events').select('*')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true }).limit(10)

    if (serverId) query = query.eq('server_id', serverId)

    const { data } = await query
    if (!data?.length) {
      await cmd.reply({ content: 'No upcoming events.', ephemeral: true })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle('Upcoming Events')
      .setColor(0x7C9070)

    for (const e of data) {
      embed.addFields({
        name: `${e.title} — ${e.date}`,
        value: `${e.description?.slice(0, 100) ?? 'No description'}\nLocation: ${e.location ?? 'TBD'} | Attendees: ${e.attendees}`,
      })
    }

    await cmd.reply({ embeds: [embed], ephemeral: true })
    return
  }

  if (sub === 'join') {
    const eventId = cmd.options.getString('event-id', true)
    const { data: event } = await supabase.from('events').select('id, title')
      .ilike('id', `${eventId}%`).single()

    if (!event) { await cmd.reply({ content: 'Event not found.', ephemeral: true }); return }

    const { error } = await supabase.from('event_registrations').insert({ event_id: event.id, user_id: userId })
    if (error) { await cmd.reply({ content: `Already registered or error: ${error.message}`, ephemeral: true }); return }

    await supabase.from('events').update({ attendees: (await supabase.from('events').select('attendees').eq('id', event.id).single()).data?.attendees + 1 }).eq('id', event.id)
    await cmd.reply({ content: `Joined event: ${event.title}!`, ephemeral: true })
    return
  }

  if (sub === 'leave') {
    const eventId = cmd.options.getString('event-id', true)
    const { data: event } = await supabase.from('events').select('id, title')
      .ilike('id', `${eventId}%`).single()

    if (!event) { await cmd.reply({ content: 'Event not found.', ephemeral: true }); return }

    await supabase.from('event_registrations').delete().eq('event_id', event.id).eq('user_id', userId)
    await cmd.reply({ content: `Left event: ${event.title}`, ephemeral: true })
    return
  }
}
```

- [ ] **Step 7: Create `bot/src/commands/mod.ts`**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild, getUserRoleInServer } from '../services/discord.js'

export async function handleModCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  const sub = cmd.options.getSubcommand()
  const modUserId = await resolveSupabaseUserId(cmd.user.id)
  const serverId = cmd.guildId ? await getServerIdFromGuild(cmd.guildId) : null

  if (!modUserId || !serverId) {
    await cmd.reply({ content: 'Unable to resolve your account or server.', ephemeral: true })
    return
  }

  // Check moderator permission
  const modRole = await getUserRoleInServer(modUserId, serverId)
  if (modRole !== 'moderator' && modRole !== 'admin') {
    await cmd.reply({ content: 'You need moderator permissions.', ephemeral: true })
    return
  }

  const actorName = cmd.user.displayName

  if (sub === 'ticket-status') {
    const ticketId = cmd.options.getString('ticket-id', true)
    const status = cmd.options.getString('status', true)

    const { data: ticket } = await supabase.from('tickets').select('id, title, discord_thread_id')
      .ilike('id', `${ticketId}%`).eq('server_id', serverId).single()

    if (!ticket) { await cmd.reply({ content: 'Ticket not found.', ephemeral: true }); return }

    await supabase.from('tickets').update({ status }).eq('id', ticket.id)

    // Post to thread if exists
    if (ticket.discord_thread_id && cmd.guild) {
      try {
        const thread = await cmd.guild.channels.fetch(ticket.discord_thread_id as string)
        if (thread?.isThread()) {
          await thread.send(`Status changed to **${status}** by ${actorName}`)
        }
      } catch { /* thread may not exist */ }
    }

    await supabase.from('admin_audit_logs').insert({
      actor_id: modUserId, actor_name: actorName,
      action: 'ticket_update', target_type: 'ticket',
      target_id: ticket.id, target_name: ticket.title,
      details: { status }, server_id: serverId,
    })

    await cmd.reply({ content: `Ticket #${ticketId} → **${status}**`, ephemeral: true })
    return
  }

  if (sub === 'ticket-assign') {
    const ticketId = cmd.options.getString('ticket-id', true)
    const assignTo = cmd.options.getUser('user', true)
    const assignUserId = await resolveSupabaseUserId(assignTo.id)

    if (!assignUserId) { await cmd.reply({ content: 'Target user not found in dashboard.', ephemeral: true }); return }

    const { data: ticket } = await supabase.from('tickets').select('id, title')
      .ilike('id', `${ticketId}%`).eq('server_id', serverId).single()

    if (!ticket) { await cmd.reply({ content: 'Ticket not found.', ephemeral: true }); return }

    await supabase.from('tickets').update({ assigned_to: assignUserId }).eq('id', ticket.id)

    await supabase.from('admin_audit_logs').insert({
      actor_id: modUserId, actor_name: actorName,
      action: 'ticket_assign', target_type: 'ticket',
      target_id: ticket.id, target_name: ticket.title,
      details: { assigned_to: assignTo.tag }, server_id: serverId,
    })

    await cmd.reply({ content: `Ticket #${ticketId} assigned to ${assignTo.tag}`, ephemeral: true })
    return
  }

  if (sub === 'feedback-review') {
    const feedbackId = cmd.options.getString('feedback-id', true)
    const status = cmd.options.getString('status', true)

    const { data: fb } = await supabase.from('feedbacks').select('id, title')
      .ilike('id', `${feedbackId}%`).eq('server_id', serverId).single()

    if (!fb) { await cmd.reply({ content: 'Feedback not found.', ephemeral: true }); return }

    await supabase.from('feedbacks').update({ status }).eq('id', fb.id)
    await cmd.reply({ content: `Feedback #${feedbackId} → **${status}**`, ephemeral: true })
    return
  }

  if (sub === 'warn') {
    const targetUser = cmd.options.getUser('user', true)
    const reason = cmd.options.getString('reason', true)
    const targetUserId = await resolveSupabaseUserId(targetUser.id)

    await supabase.from('admin_audit_logs').insert({
      actor_id: modUserId, actor_name: actorName,
      action: 'warn', target_type: 'user',
      target_id: targetUserId ?? targetUser.id,
      target_name: targetUser.tag,
      details: { reason }, server_id: serverId,
    })

    // DM the user
    try {
      await targetUser.send(`You have been warned in **${cmd.guild?.name}**.\nReason: ${reason}`)
    } catch { /* DMs may be disabled */ }

    await cmd.reply({ content: `${targetUser.tag} warned. Reason: ${reason}`, ephemeral: true })
    return
  }

  if (sub === 'timeout') {
    const targetUser = cmd.options.getUser('user', true)
    const duration = cmd.options.getInteger('duration', true)
    const reason = cmd.options.getString('reason') ?? 'No reason provided'

    const member = await cmd.guild?.members.fetch(targetUser.id)
    if (!member) { await cmd.reply({ content: 'Member not found in server.', ephemeral: true }); return }

    await member.timeout(duration * 60 * 1000, reason)

    const targetUserId = await resolveSupabaseUserId(targetUser.id)
    if (targetUserId) {
      // Update user metadata
      await supabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: { timeout_until: new Date(Date.now() + duration * 60 * 1000).toISOString() },
      })
    }

    await supabase.from('admin_audit_logs').insert({
      actor_id: modUserId, actor_name: actorName,
      action: 'timeout', target_type: 'user',
      target_id: targetUserId ?? targetUser.id,
      target_name: targetUser.tag,
      details: { duration_minutes: duration, reason }, server_id: serverId,
    })

    await cmd.reply({ content: `${targetUser.tag} timed out for ${duration} minutes.`, ephemeral: true })
    return
  }

  if (sub === 'kick') {
    const targetUser = cmd.options.getUser('user', true)
    const reason = cmd.options.getString('reason') ?? 'No reason provided'

    const member = await cmd.guild?.members.fetch(targetUser.id)
    if (!member) { await cmd.reply({ content: 'Member not found.', ephemeral: true }); return }

    await member.kick(reason)

    const targetUserId = await resolveSupabaseUserId(targetUser.id)
    await supabase.from('admin_audit_logs').insert({
      actor_id: modUserId, actor_name: actorName,
      action: 'kick', target_type: 'user',
      target_id: targetUserId ?? targetUser.id,
      target_name: targetUser.tag,
      details: { reason }, server_id: serverId,
    })

    await cmd.reply({ content: `${targetUser.tag} kicked. Reason: ${reason}`, ephemeral: true })
    return
  }
}
```

- [ ] **Step 8: Wire handler into `bot/src/index.ts`**

Add:
```typescript
import { registerCommandHandler } from './commands/handler.js'
registerCommandHandler(client)
```

- [ ] **Step 9: Commit**

```bash
git add bot/src/
git commit -m "feat: 實作所有 slash command handlers (ticket, feedback, profile, event, mod)"
```

---

### Task 3.6: Ticket channel message listener

**Files:**
- Create: `bot/src/listeners/messageCreate.ts`

- [ ] **Step 1: Create the listener**

```typescript
import { Events, Message, ChannelType } from 'discord.js'
import type { Client } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bots, DMs, and threads
    if (message.author.bot) return
    if (!message.guild) return
    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
      await handleThreadReply(message)
      return
    }

    // Check if this channel is a ticket intake channel
    const serverId = await getServerIdFromGuild(message.guild.id)
    if (!serverId) return

    const { data: server } = await supabase
      .from('servers')
      .select('settings')
      .eq('id', serverId)
      .single()

    if (!server) return

    const settings = server.settings as { ticket_channels?: string[] }
    if (!settings.ticket_channels?.includes(message.channel.id)) return

    // This is a ticket channel message — create a ticket
    const userId = await resolveSupabaseUserId(message.author.id)
    if (!userId) {
      await message.reply('You must log in to the dashboard first to create tickets.')
      return
    }

    const title = message.content.slice(0, 200) || 'Untitled ticket'
    const content = message.content || 'No content'

    const { data: ticket, error } = await supabase.from('tickets').insert({
      title,
      content,
      category: 'general',
      priority: 'normal',
      source: 'discord',
      created_by: userId,
      server_id: serverId,
      discord_channel_id: message.channel.id,
      discord_message_id: message.id,
    }).select('id').single()

    if (error) {
      console.error('Failed to create ticket from message:', error)
      return
    }

    // React to confirm
    await message.react('✅')

    // Create thread
    const thread = await message.startThread({
      name: `Ticket #${ticket.id.slice(0, 8)}: ${title.slice(0, 50)}`,
      autoArchiveDuration: 10080,
    })

    await supabase.from('tickets').update({ discord_thread_id: thread.id }).eq('id', ticket.id)
    await thread.send(`Ticket created! ID: \`${ticket.id.slice(0, 8)}\`\nReply in this thread to add updates.`)
  })
}

async function handleThreadReply(message: Message): Promise<void> {
  if (message.author.bot) return

  // Check if this thread is linked to a ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('discord_thread_id', message.channel.id)
    .single()

  if (!ticket) return

  const userId = await resolveSupabaseUserId(message.author.id)
  if (!userId) return

  await supabase.from('ticket_replies').insert({
    ticket_id: ticket.id,
    content: message.content,
    author_id: userId,
  })
}
```

- [ ] **Step 2: Wire into `bot/src/index.ts`**

```typescript
import { registerMessageCreate } from './listeners/messageCreate.js'
registerMessageCreate(client)
```

- [ ] **Step 3: Commit**

```bash
git add bot/src/listeners/messageCreate.ts bot/src/index.ts
git commit -m "feat: Ticket channel 訊息監聽與自動建立 ticket"
```

---

## Phase 4: Bidirectional Sync & Webhooks

### Task 4.1: Action queue worker (Supabase Realtime)

**Files:**
- Create: `bot/src/workers/actionQueue.ts`

- [ ] **Step 1: Create the worker**

```typescript
import type { Client } from 'discord.js'
import { supabase } from '../services/supabase.js'

export function startActionQueueWorker(client: Client): void {
  // Process any pending actions from before bot started
  processBacklog(client)

  // Subscribe to new inserts
  supabase
    .channel('bot-actions')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pending_bot_actions' },
      async (payload) => {
        await processAction(client, payload.new as Record<string, unknown>)
      }
    )
    .subscribe((status) => {
      console.log(`Action queue subscription: ${status}`)
    })
}

async function processBacklog(client: Client): Promise<void> {
  const { data: pending } = await supabase
    .from('pending_bot_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (!pending?.length) return
  console.log(`Processing ${pending.length} backlogged actions...`)

  for (const action of pending) {
    await processAction(client, action as Record<string, unknown>)
  }
}

async function processAction(
  client: Client,
  action: Record<string, unknown>,
): Promise<void> {
  const id = action.id as string
  const actionType = action.action_type as string
  const payload = action.payload as Record<string, unknown>

  // Mark as processing
  await supabase.from('pending_bot_actions')
    .update({ status: 'processing' })
    .eq('id', id)

  try {
    switch (actionType) {
      case 'ban_user': {
        const guild = await client.guilds.fetch(payload.guild_id as string)
        await guild.members.ban(payload.user_id as string, {
          reason: (payload.reason as string) ?? undefined,
        })
        break
      }
      case 'unban_user': {
        const guild = await client.guilds.fetch(payload.guild_id as string)
        await guild.members.unban(payload.user_id as string)
        break
      }
      case 'kick_user': {
        const guild = await client.guilds.fetch(payload.guild_id as string)
        const member = await guild.members.fetch(payload.user_id as string)
        await member.kick((payload.reason as string) ?? undefined)
        break
      }
      case 'timeout_user': {
        const guild = await client.guilds.fetch(payload.guild_id as string)
        const member = await guild.members.fetch(payload.user_id as string)
        const duration = (payload.duration_minutes as number) * 60 * 1000
        await member.timeout(duration, (payload.reason as string) ?? undefined)
        break
      }
      case 'sync_role': {
        const guild = await client.guilds.fetch(payload.guild_id as string)
        const member = await guild.members.fetch(payload.user_id as string)
        if (payload.action === 'add') {
          await member.roles.add(payload.role_id as string)
        } else {
          await member.roles.remove(payload.role_id as string)
        }
        break
      }
      case 'send_message': {
        const channel = await client.channels.fetch(payload.channel_id as string)
        if (channel?.isTextBased()) {
          await channel.send({
            content: (payload.content as string) ?? undefined,
            embeds: payload.embed ? [payload.embed as never] : undefined,
          })
        }
        break
      }
      case 'update_thread': {
        const thread = await client.channels.fetch(payload.thread_id as string)
        if (thread?.isThread()) {
          await thread.send(payload.content as string)
        }
        break
      }
      default:
        throw new Error(`Unknown action type: ${actionType}`)
    }

    await supabase.from('pending_bot_actions')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', id)

    console.log(`Action ${actionType} (${id.slice(0, 8)}) completed`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await supabase.from('pending_bot_actions')
      .update({ status: 'failed', error_message: errorMessage, processed_at: new Date().toISOString() })
      .eq('id', id)

    console.error(`Action ${actionType} (${id.slice(0, 8)}) failed:`, errorMessage)
  }
}
```

- [ ] **Step 2: Wire into `bot/src/index.ts`**

```typescript
import { startActionQueueWorker } from './workers/actionQueue.js'

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  await fullSync(client)
  startActionQueueWorker(client)
})
```

- [ ] **Step 3: Commit**

```bash
git add bot/src/workers/actionQueue.ts bot/src/index.ts
git commit -m "feat: Action queue worker — Supabase Realtime 訂閱處理 bot actions"
```

---

### Task 4.2: Webhook notification sender

**Files:**
- Create: `bot/src/workers/webhookSender.ts`

- [ ] **Step 1: Create the webhook sender**

```typescript
import { supabase } from '../services/supabase.js'

interface WebhookEmbed {
  title: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  timestamp?: string
}

async function getServerWebhookUrl(serverId: string): Promise<string | null> {
  const { data } = await supabase
    .from('servers')
    .select('settings')
    .eq('id', serverId)
    .single()

  const url = (data?.settings as Record<string, unknown>)?.notification_webhook_url as string
  if (!url || url === 'not_configured' || url === '') return null
  return url
}

export async function sendWebhookNotification(
  serverId: string,
  embed: WebhookEmbed,
): Promise<void> {
  const webhookUrl = await getServerWebhookUrl(serverId)
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          ...embed,
          color: embed.color ?? 0x7C9070,
          timestamp: embed.timestamp ?? new Date().toISOString(),
        }],
      }),
    })
  } catch (err) {
    console.error(`Webhook send failed for server ${serverId}:`, err)
  }
}

export async function notifyNewTicket(
  serverId: string,
  ticket: { title: string; category: string; priority: string; author_name: string },
): Promise<void> {
  const { data: server } = await supabase.from('servers').select('settings').eq('id', serverId).single()
  if (!(server?.settings as Record<string, unknown>)?.notify_new_ticket) return

  await sendWebhookNotification(serverId, {
    title: 'New Ticket',
    description: `**${ticket.title}**`,
    fields: [
      { name: 'Category', value: ticket.category, inline: true },
      { name: 'Priority', value: ticket.priority, inline: true },
      { name: 'Author', value: ticket.author_name, inline: true },
    ],
  })
}

export async function notifyTicketStatusChange(
  serverId: string,
  ticket: { title: string; status: string; changed_by: string },
): Promise<void> {
  const { data: server } = await supabase.from('servers').select('settings').eq('id', serverId).single()
  if (!(server?.settings as Record<string, unknown>)?.notify_ticket_status_change) return

  await sendWebhookNotification(serverId, {
    title: 'Ticket Status Updated',
    description: `**${ticket.title}** → ${ticket.status}`,
    fields: [
      { name: 'Changed by', value: ticket.changed_by },
    ],
  })
}

export async function notifyNewFeedback(
  serverId: string,
  feedback: { title: string; category: string; author_name: string },
): Promise<void> {
  const { data: server } = await supabase.from('servers').select('settings').eq('id', serverId).single()
  if (!(server?.settings as Record<string, unknown>)?.notify_new_feedback) return

  await sendWebhookNotification(serverId, {
    title: 'New Feedback',
    description: `**${feedback.title}**`,
    fields: [
      { name: 'Category', value: feedback.category, inline: true },
      { name: 'Author', value: feedback.author_name, inline: true },
    ],
  })
}

export async function notifyModAction(
  serverId: string,
  action: { type: string; target_name: string; actor_name: string; reason?: string },
): Promise<void> {
  await sendWebhookNotification(serverId, {
    title: `User ${action.type}`,
    description: `**${action.target_name}** was ${action.type} by ${action.actor_name}`,
    fields: action.reason ? [{ name: 'Reason', value: action.reason }] : [],
    color: 0xFF6B6B,
  })
}
```

- [ ] **Step 2: Integrate webhook calls into existing command handlers**

In `bot/src/commands/ticket.ts`, after creating a ticket:
```typescript
import { notifyNewTicket } from '../workers/webhookSender.js'
// After insert succeeds:
if (serverId) {
  await notifyNewTicket(serverId, { title, category, priority, author_name: cmd.user.displayName })
}
```

Same pattern for feedback and mod commands.

- [ ] **Step 3: Commit**

```bash
git add bot/src/workers/webhookSender.ts bot/src/commands/
git commit -m "feat: Webhook 通知系統 — ticket, feedback, moderation 事件"
```

---

### Task 4.3: Dashboard → Discord thread sync (via pending_bot_actions)

**Files:**
- Modify: `supabase/functions/manage-tickets/index.ts`

- [ ] **Step 1: In the `update` action, queue a thread update**

After updating the ticket status, if the ticket has a `discord_thread_id`, queue a bot action:

```typescript
// After the ticket update succeeds
if (data.discord_thread_id) {
  await sc.from('pending_bot_actions').insert({
    action_type: 'update_thread',
    payload: {
      thread_id: data.discord_thread_id,
      content: `Status changed to **${status}** by ${actorName}`,
    },
    status: 'pending',
    created_by: user.id,
    server_id: body.server_id ?? null,
  })
}
```

- [ ] **Step 2: In the `reply` action, queue a thread message**

```typescript
// After inserting ticket_reply
const { data: parentTicket } = await supabaseClient
  .from('tickets')
  .select('discord_thread_id')
  .eq('id', ticket_id)
  .single()

if (parentTicket?.discord_thread_id) {
  await sc.from('pending_bot_actions').insert({
    action_type: 'update_thread',
    payload: {
      thread_id: parentTicket.discord_thread_id,
      content: `**${actorName}:** ${content}`,
    },
    status: 'pending',
    created_by: user.id,
    server_id: body.server_id ?? null,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/manage-tickets/
git commit -m "feat: Dashboard ticket 更新同步到 Discord thread"
```

---

### Task 4.4: Update `manage-users` to queue Discord actions

**Files:**
- Modify: `supabase/functions/manage-users/index.ts`

- [ ] **Step 1: In ban/kick/timeout actions, include Discord guild_id in the pending_bot_actions payload**

When banning, kicking, or timing out a user from the dashboard, the Edge Function already inserts into `pending_bot_actions`. Update the payload to include the Discord guild_id and Discord user_id (not Supabase user_id):

```typescript
// When banning
// First, resolve the user's Discord ID
const { data: targetUser } = await sc.auth.admin.getUserById(body.user_id)
const discordIdentity = targetUser?.user?.identities?.find(
  (i: { provider: string }) => i.provider === 'discord'
)

if (discordIdentity && body.server_id) {
  // Get the guild_id from the server
  const { data: server } = await sc.from('servers')
    .select('discord_guild_id')
    .eq('id', body.server_id)
    .single()

  if (server) {
    await sc.from('pending_bot_actions').insert({
      action_type: 'ban_user',
      payload: {
        user_id: discordIdentity.id,
        guild_id: server.discord_guild_id,
        reason: body.reason,
      },
      status: 'pending',
      created_by: user.id,
      server_id: body.server_id,
    })
  }
}
```

Apply the same pattern for `kick` and `timeout` actions.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/manage-users/
git commit -m "feat: Dashboard ban/kick/timeout 同步到 Discord (pending_bot_actions)"
```

---

### Task 4.5: Update `bot/src/index.ts` — final wiring

**Files:**
- Modify: `bot/src/index.ts`

- [ ] **Step 1: Ensure all listeners and workers are registered**

Final `index.ts`:

```typescript
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'
import { registerMessageCreate } from './listeners/messageCreate.js'
import { registerCommandHandler } from './commands/handler.js'
import { startActionQueueWorker } from './workers/actionQueue.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

// Register event listeners
registerGuildMemberAdd(client)
registerGuildMemberRemove(client)
registerMessageCreate(client)
registerCommandHandler(client)

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  console.log(`Serving ${c.guilds.cache.size} guilds`)
  await fullSync(client)
  startActionQueueWorker(client)
  console.log('All systems operational')
})

process.on('SIGINT', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

client.login(config.discord.token)
```

- [ ] **Step 2: Add modal submit handler for profile edit**

In `bot/src/commands/handler.ts`, add modal interaction handling:

```typescript
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isModalSubmit() && interaction.customId === 'profile-edit-modal') {
    const bio = interaction.fields.getTextInputValue('bio')
    const skillTagsRaw = interaction.fields.getTextInputValue('skill_tags')
    const skillTags = skillTagsRaw.split(',').map(t => t.trim()).filter(Boolean)

    const userId = await resolveSupabaseUserId(interaction.user.id)
    if (!userId) {
      await interaction.reply({ content: 'Account not linked.', ephemeral: true })
      return
    }

    const updates: Record<string, unknown> = {}
    if (bio) updates.bio = bio
    if (skillTags.length) updates.skill_tags = skillTags

    await supabase.from('member_profiles').update(updates).eq('user_id', userId)
    await interaction.reply({ content: 'Profile updated!', ephemeral: true })
    return
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add bot/src/
git commit -m "feat: Bot 最終整合 — 所有 listeners, workers, handlers 連接完成"
```

---

### Task 4.6: Add i18n keys for new UI elements

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-TW.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/ja.json`

- [ ] **Step 1: Add keys to all locale files**

Keys to add:
```json
{
  "nav.select_server": "Select Server",
  "profile.visibility": "Visibility",
  "profile.visibility.public": "Public",
  "profile.visibility.members_only": "Members Only",
  "profile.visibility.private": "Private",
  "profile.visibility.custom": "Custom",
  "profile.visibility.preset": "Preset",
  "settings.server": "Server",
  "settings.ticket_channels": "Ticket Channels",
  "settings.role_mapping": "Role Mapping",
  "settings.notifications": "Notifications"
}
```

Translate each key into zh-TW, zh-CN, ja.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/
git commit -m "feat: 新增多伺服器與可見度相關 i18n 翻譯"
```

---

### Task 4.7: Render.com deployment config

**Files:**
- Create: `bot/render.yaml` (or update root `render.yaml` if it exists)

- [ ] **Step 1: Create Render service definition**

```yaml
# bot/render.yaml
services:
  - type: worker
    name: suslab-discord-bot
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    rootDir: bot
    envVars:
      - key: DISCORD_BOT_TOKEN
        sync: false
      - key: DISCORD_CLIENT_ID
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

- [ ] **Step 2: Commit**

```bash
git add bot/render.yaml
git commit -m "chore: 新增 Render.com bot worker 部署設定"
```

---

### Task 4.8: Update `.gitignore` and root config

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add bot-specific entries**

```
bot/node_modules/
bot/dist/
bot/.env
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: 更新 .gitignore 包含 bot 目錄"
```

---

### Task 4.9: Final verification

- [ ] **Step 1: Build SPA**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Build bot**

```bash
cd bot && npm run build
```

Expected: TypeScript compilation succeeds.

- [ ] **Step 3: Lint SPA**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Verify all migrations applied**

Check Supabase SQL Editor — all tables and columns present.

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: Discord bot 與多伺服器整合完成"
git push
```
