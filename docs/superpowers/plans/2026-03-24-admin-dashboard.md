# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full Admin Dashboard with role management, user management (ban/kick/timeout), tickets, feedback review, system settings, audit logging, and pending bot actions.

**Architecture:** Six admin pages under `/admin/*` routes, each backed by Supabase Edge Functions and protected by `moderator+` role check. All admin actions are logged to `admin_audit_logs`. Discord bot operations (kick/ban/role sync) are queued in `pending_bot_actions` for future bot integration.

**Permission Design:** Moderators can: view users, ban/kick/timeout users, manage tickets, review feedback. Admins can: all moderator actions + manage roles, delete tickets, change user roles, update system settings. Audit log INSERT and pending_bot_actions INSERT are done exclusively via service_role client in edge functions (no RLS INSERT policy needed).

**Tech Stack:** React 19, MUI v6, react-i18next, Supabase Edge Functions (Deno), PostgreSQL with RLS

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/011_discord_roles.sql` | discord_roles table for role management + RLS |
| `supabase/migrations/012_admin_audit_logs.sql` | admin_audit_logs table + RLS |
| `supabase/migrations/013_pending_bot_actions.sql` | pending_bot_actions queue table + RLS |
| `supabase/migrations/014_tickets.sql` | tickets + ticket_replies tables + RLS |
| `supabase/migrations/015_system_settings.sql` | system_settings KV table + RLS |
| `supabase/functions/manage-roles/index.ts` | CRUD discord roles + audit log |
| `supabase/functions/manage-tickets/index.ts` | Tickets CRUD + replies |
| `supabase/functions/admin-overview/index.ts` | Admin dashboard stats |
| `supabase/functions/admin-settings/index.ts` | System settings CRUD |
| `src/components/admin/UserActionDialog.jsx` | Ban/kick/timeout dialog with reason field |
| `src/components/admin/RoleDialog.jsx` | Create/edit role dialog |
| `src/components/admin/TicketDetailDialog.jsx` | Ticket detail + replies dialog |
| `src/components/admin/TicketCreateDialog.jsx` | Create ticket dialog (website form) |
| `src/components/admin/AuditLogTable.jsx` | Audit log table with filters |
| `src/pages/admin/Overview.jsx` | Admin overview dashboard |

### Modified Files

| File | Changes |
|------|---------|
| `supabase/functions/manage-users/index.ts` | Add ban/kick/timeout/unban actions + audit logging |
| `src/pages/admin/Roles.jsx` | Rewrite from stub to full role management |
| `src/pages/admin/Users.jsx` | Add ban/kick/timeout buttons + action log |
| `src/pages/admin/Tickets.jsx` | Rewrite from stub to ticket management |
| `src/pages/admin/FeedbackReview.jsx` | Rewrite from stub to feedback review with reply |
| `src/pages/admin/Settings.jsx` | Rewrite from stub to system settings |
| `src/services/edgeFunctions.js` | Add all new admin API functions |
| `src/App.jsx` | Add `/admin` overview route |
| `src/components/NavRail.jsx` | Add overview nav item |
| `src/i18n/locales/en.json` | Add all admin i18n keys |
| `src/i18n/locales/ja.json` | Add all admin i18n keys |
| `src/i18n/locales/zh-CN.json` | Add all admin i18n keys |
| `src/i18n/locales/zh-TW.json` | Add all admin i18n keys |

---

## Task 1: SQL Migrations

**Files:**
- Create: `supabase/migrations/011_discord_roles.sql`
- Create: `supabase/migrations/012_admin_audit_logs.sql`
- Create: `supabase/migrations/013_pending_bot_actions.sql`
- Create: `supabase/migrations/014_tickets.sql`
- Create: `supabase/migrations/015_system_settings.sql`

- [ ] **Step 1: Create discord_roles migration**

```sql
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
```

- [ ] **Step 2: Create admin_audit_logs migration**

```sql
-- supabase/migrations/012_admin_audit_logs.sql
-- Audit log for all admin actions

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

-- Moderator+ can read audit logs
CREATE POLICY "moderator_read_audit" ON public.admin_audit_logs
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — audit rows are inserted exclusively via service_role
-- client in edge functions, which bypasses RLS.

CREATE INDEX idx_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_audit_action ON public.admin_audit_logs (action);
CREATE INDEX idx_audit_target ON public.admin_audit_logs (target_type, target_id);
```

- [ ] **Step 3: Create pending_bot_actions migration**

```sql
-- supabase/migrations/013_pending_bot_actions.sql
-- Queue for Discord bot actions (executed when bot comes online)

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

-- Moderator+ can read pending actions
CREATE POLICY "moderator_read_pending" ON public.pending_bot_actions
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — pending actions are inserted via service_role in edge functions.

-- Admin can update status (or service_role)
CREATE POLICY "admin_update_pending" ON public.pending_bot_actions
  FOR UPDATE USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE INDEX idx_pending_status ON public.pending_bot_actions (status) WHERE status = 'pending';
```

- [ ] **Step 4: Create tickets migration**

```sql
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
```

- [ ] **Step 5: Create system_settings migration**

```sql
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
```

- [ ] **Step 6: Commit migrations**

```bash
git add supabase/migrations/011_discord_roles.sql supabase/migrations/012_admin_audit_logs.sql supabase/migrations/013_pending_bot_actions.sql supabase/migrations/014_tickets.sql supabase/migrations/015_system_settings.sql
git commit -m "feat: add admin dashboard SQL migrations (roles, audit, tickets, settings)"
```

---

## Task 2: Edge Functions

**Files:**
- Create: `supabase/functions/manage-roles/index.ts`
- Create: `supabase/functions/manage-tickets/index.ts`
- Create: `supabase/functions/admin-overview/index.ts`
- Create: `supabase/functions/admin-settings/index.ts`
- Modify: `supabase/functions/manage-users/index.ts`

- [ ] **Step 1: Create manage-roles edge function**

```typescript
// supabase/functions/manage-roles/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

async function logAudit(
  client: ReturnType<typeof createClient>,
  actorId: string,
  actorName: string,
  action: string,
  targetType: string,
  targetId: string | null,
  targetName: string | null,
  details: Record<string, unknown> = {},
) {
  await client.from('admin_audit_logs').insert({
    actor_id: actorId,
    actor_name: actorName,
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    details,
  })
}

async function queueBotAction(
  client: ReturnType<typeof createClient>,
  actionType: string,
  payload: Record<string, unknown>,
  createdBy: string,
) {
  await client.from('pending_bot_actions').insert({
    action_type: actionType,
    payload,
    created_by: createdBy,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()
    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    if (action === 'list') {
      const { data, error } = await supabaseClient
        .from('discord_roles')
        .select('*')
        .order('position', { ascending: true })

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'create') {
      if (role !== 'admin') return errorResponse('Only admin can create roles', 403)

      const { name, color, permissions, position } = body
      if (!name) return errorResponse('Missing role name', 400)

      const { data, error } = await supabaseClient
        .from('discord_roles')
        .insert({
          name,
          color: color ?? '#99AAB5',
          permissions: permissions ?? {},
          position: position ?? 0,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_create', 'role', data.id, name, { color })
      await queueBotAction(sc, 'create_role', { name, color, permissions }, user.id)

      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      if (role !== 'admin') return errorResponse('Only admin can update roles', 403)

      const { id, name, color, permissions, position } = body
      if (!id) return errorResponse('Missing role id', 400)

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (name !== undefined) updates.name = name
      if (color !== undefined) updates.color = color
      if (permissions !== undefined) updates.permissions = permissions
      if (position !== undefined) updates.position = position

      const { data, error } = await supabaseClient
        .from('discord_roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_update', 'role', id, data.name, updates)
      if (data.discord_role_id) {
        await queueBotAction(sc, 'update_role', { discord_role_id: data.discord_role_id, ...updates }, user.id)
      }

      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') return errorResponse('Only admin can delete roles', 403)

      const { id } = body
      if (!id) return errorResponse('Missing role id', 400)

      // Get role before deleting for audit
      const { data: existing } = await supabaseClient
        .from('discord_roles')
        .select('name, discord_role_id')
        .eq('id', id)
        .single()

      const { error } = await supabaseClient
        .from('discord_roles')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_delete', 'role', id, existing?.name ?? 'Unknown', {})
      if (existing?.discord_role_id) {
        await queueBotAction(sc, 'delete_role', { discord_role_id: existing.discord_role_id }, user.id)
      }

      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Create manage-tickets edge function**

```typescript
// supabase/functions/manage-tickets/index.ts
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
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()
    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    if (action === 'list') {
      const isMod = role === 'moderator' || role === 'admin'
      let query = supabaseClient
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      // Members only see their own tickets
      if (!isMod) {
        query = query.eq('created_by', user.id)
      }

      // Optional status filter
      if (body.status) {
        query = query.eq('status', body.status)
      }

      const page = body.page ?? 1
      const pageSize = body.pageSize ?? 20
      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)

      // Enrich with author info
      const userIds = [...new Set((data ?? []).map((t: { created_by: string }) => t.created_by))]
      const { data: users } = await sc.auth.admin.listUsers()
      const userMap = new Map(
        (users?.users ?? []).map((u: { id: string; user_metadata?: Record<string, unknown>; email?: string }) => [
          u.id,
          {
            display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
            avatar_url: u.user_metadata?.avatar_url as string | null,
          },
        ])
      )

      const enriched = (data ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        author_name: (userMap.get(t.created_by as string) as { display_name: string } | undefined)?.display_name ?? 'Unknown',
        author_avatar: (userMap.get(t.created_by as string) as { avatar_url: string | null } | undefined)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    if (action === 'create') {
      const { title, content, category, priority } = body
      if (!title || !content) return errorResponse('Missing title or content', 400)

      const { data, error } = await supabaseClient
        .from('tickets')
        .insert({
          title,
          content,
          category: category ?? 'general',
          priority: priority ?? 'normal',
          source: 'web',
          created_by: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Audit log
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_create',
        target_type: 'ticket',
        target_id: data.id,
        target_name: title,
        details: { category, priority },
      })

      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const isMod = role === 'moderator' || role === 'admin'
      if (!isMod) return errorResponse('Only moderator+ can update tickets', 403)

      const { id, status, priority, assigned_to } = body
      if (!id) return errorResponse('Missing ticket id', 400)

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status !== undefined) updates.status = status
      if (priority !== undefined) updates.priority = priority
      if (assigned_to !== undefined) updates.assigned_to = assigned_to

      const { data, error } = await supabaseClient
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_update',
        target_type: 'ticket',
        target_id: id,
        target_name: data.title,
        details: updates,
      })

      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') return errorResponse('Only admin can delete tickets', 403)

      const { id } = body
      if (!id) return errorResponse('Missing ticket id', 400)

      const { data: existing } = await supabaseClient
        .from('tickets')
        .select('title')
        .eq('id', id)
        .single()

      const { error } = await supabaseClient
        .from('tickets')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_delete',
        target_type: 'ticket',
        target_id: id,
        target_name: existing?.title ?? 'Unknown',
        details: {},
      })

      return jsonResponse({ success: true })
    }

    if (action === 'reply') {
      const { ticket_id, content } = body
      if (!ticket_id || !content) return errorResponse('Missing ticket_id or content', 400)

      const { data, error } = await supabaseClient
        .from('ticket_replies')
        .insert({
          ticket_id,
          content,
          author_id: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ ...data, author_name: actorName })
    }

    if (action === 'replies') {
      const { ticket_id } = body
      if (!ticket_id) return errorResponse('Missing ticket_id', 400)

      const { data, error } = await supabaseClient
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true })

      if (error) return errorResponse(error.message, 500)

      // Enrich with author info
      const { data: users } = await sc.auth.admin.listUsers()
      const userMap = new Map(
        (users?.users ?? []).map((u: { id: string; user_metadata?: Record<string, unknown>; email?: string }) => [
          u.id,
          {
            display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
            avatar_url: u.user_metadata?.avatar_url as string | null,
          },
        ])
      )

      const enriched = (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        author_name: (userMap.get(r.author_id as string) as { display_name: string } | undefined)?.display_name ?? 'Unknown',
        author_avatar: (userMap.get(r.author_id as string) as { avatar_url: string | null } | undefined)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    return errorResponse('Invalid action. Use: list, create, update, delete, reply, replies', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 3: Create admin-overview edge function**

```typescript
// supabase/functions/admin-overview/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await verifyAuth(req, 'moderator')

    const sc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parallel queries
    const [ticketsRes, feedbackRes, usersRes, recentAuditRes, pendingActionsRes] = await Promise.all([
      supabaseClient.from('tickets').select('status', { count: 'exact', head: false }),
      supabaseClient.from('feedbacks').select('status', { count: 'exact', head: false }),
      sc.auth.admin.listUsers(),
      supabaseClient.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabaseClient.from('pending_bot_actions').select('*', { count: 'exact' }).eq('status', 'pending'),
    ])

    const tickets = ticketsRes.data ?? []
    const feedbacks = feedbackRes.data ?? []
    const openTickets = tickets.filter((t: { status: string }) => t.status === 'open' || t.status === 'in_progress').length
    const openFeedback = feedbacks.filter((f: { status: string }) => f.status === 'open').length

    return jsonResponse({
      total_users: usersRes.data?.users?.length ?? 0,
      total_tickets: tickets.length,
      open_tickets: openTickets,
      total_feedback: feedbacks.length,
      open_feedback: openFeedback,
      pending_bot_actions: pendingActionsRes.count ?? 0,
      recent_audit: recentAuditRes.data ?? [],
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 4: Create admin-settings edge function**

```typescript
// supabase/functions/admin-settings/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .order('key')

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'get') {
      const { key } = body
      if (!key) return errorResponse('Missing key', 400)

      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .eq('key', key)
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'update') {
      if (role !== 'admin') return errorResponse('Only admin can update settings', 403)

      const { key, value } = body
      if (!key || value === undefined) return errorResponse('Missing key or value', 400)

      const { data, error } = await supabaseClient
        .from('system_settings')
        .update({
          value: JSON.parse(JSON.stringify(value)),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Audit log
      const sc = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'setting_update',
        target_type: 'setting',
        target_id: key,
        target_name: key,
        details: { value },
      })

      return jsonResponse(data)
    }

    if (action === 'batch-update') {
      if (role !== 'admin') return errorResponse('Only admin can update settings', 403)

      const { settings } = body
      if (!settings || !Array.isArray(settings)) return errorResponse('Missing settings array', 400)

      const results = []
      for (const { key, value } of settings) {
        const { data, error } = await supabaseClient
          .from('system_settings')
          .update({
            value: JSON.parse(JSON.stringify(value)),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .select()
          .single()

        if (error) return errorResponse(`Failed to update ${key}: ${error.message}`, 500)
        results.push(data)
      }

      return jsonResponse(results)
    }

    return errorResponse('Invalid action. Use: list, get, update, batch-update', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 5: Replace manage-users edge function**

Replace entire `supabase/functions/manage-users/index.ts` with enhanced version that adds ban/kick/timeout/unban actions + audit logging:

```typescript
// supabase/functions/manage-users/index.ts
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
    const { user, role, supabaseClient } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()
    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    if (action === 'list') {
      if (role !== 'admin') return errorResponse('Only admin can list users', 403)

      const { data: { users }, error: usersError } = await sc.auth.admin.listUsers()
      if (usersError) return errorResponse(usersError.message, 500)

      const { data: roles, error: rolesError } = await supabaseClient
        .from('user_roles')
        .select('user_id, role, updated_at')

      if (rolesError) return errorResponse(rolesError.message, 500)

      const roleMap = new Map(roles?.map((r: { user_id: string; role: string; updated_at: string }) => [r.user_id, r]) ?? [])

      const userList = users.map((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string; banned_until?: string }) => ({
        id: u.id,
        email: u.email,
        display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
        avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
        role: (roleMap.get(u.id) as { role: string } | undefined)?.role ?? 'member',
        role_updated_at: (roleMap.get(u.id) as { updated_at: string } | undefined)?.updated_at ?? null,
        created_at: u.created_at,
        is_banned: u.user_metadata?.is_banned === true,
        ban_reason: (u.user_metadata?.ban_reason as string) ?? null,
        timeout_until: (u.user_metadata?.timeout_until as string) ?? null,
      }))

      return jsonResponse(userList)
    }

    if (action === 'update-role') {
      if (role !== 'admin') return errorResponse('Only admin can change roles', 403)

      const { user_id, role: newRole } = body
      if (!user_id || !newRole) return errorResponse('Missing user_id or role', 400)
      if (!['admin', 'moderator', 'member'].includes(newRole)) {
        return errorResponse('Invalid role. Must be admin, moderator, or member', 400)
      }
      if (user_id === user.id) return errorResponse('Cannot change your own role', 400)

      const { data, error } = await supabaseClient
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Get target user name for audit
      const { data: { user: targetUser } } = await sc.auth.admin.getUserById(user_id)
      const targetName = (targetUser?.user_metadata?.full_name ?? targetUser?.user_metadata?.user_name ?? 'Unknown') as string

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'role_change',
        target_type: 'user',
        target_id: user_id,
        target_name: targetName,
        details: { new_role: newRole },
      })

      // Queue bot action for Discord role sync
      await sc.from('pending_bot_actions').insert({
        action_type: 'sync_role',
        payload: { user_id, new_role: newRole },
        created_by: user.id,
      })

      return jsonResponse({ ...data, notice: 'Role updated. User must re-login.' })
    }

    if (action === 'ban') {
      const { user_id, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (user_id === user.id) return errorResponse('Cannot ban yourself', 400)

      // Update user metadata to mark as banned
      const { error } = await sc.auth.admin.updateUserById(user_id, {
        user_metadata: { is_banned: true, ban_reason: reason ?? 'No reason provided' },
      })
      if (error) return errorResponse(error.message, 500)

      const { data: { user: targetUser } } = await sc.auth.admin.getUserById(user_id)
      const targetName = (targetUser?.user_metadata?.full_name ?? targetUser?.user_metadata?.user_name ?? 'Unknown') as string

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'user_ban',
        target_type: 'user',
        target_id: user_id,
        target_name: targetName,
        details: { reason },
      })

      await sc.from('pending_bot_actions').insert({
        action_type: 'ban_user',
        payload: { user_id, reason },
        created_by: user.id,
      })

      return jsonResponse({ success: true, action: 'banned' })
    }

    if (action === 'unban') {
      const { user_id } = body
      if (!user_id) return errorResponse('Missing user_id', 400)

      const { error } = await sc.auth.admin.updateUserById(user_id, {
        user_metadata: { is_banned: false, ban_reason: null },
      })
      if (error) return errorResponse(error.message, 500)

      const { data: { user: targetUser } } = await sc.auth.admin.getUserById(user_id)
      const targetName = (targetUser?.user_metadata?.full_name ?? targetUser?.user_metadata?.user_name ?? 'Unknown') as string

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'user_unban',
        target_type: 'user',
        target_id: user_id,
        target_name: targetName,
        details: {},
      })

      await sc.from('pending_bot_actions').insert({
        action_type: 'unban_user',
        payload: { user_id },
        created_by: user.id,
      })

      return jsonResponse({ success: true, action: 'unbanned' })
    }

    if (action === 'kick') {
      const { user_id, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (user_id === user.id) return errorResponse('Cannot kick yourself', 400)

      const { data: { user: targetUser } } = await sc.auth.admin.getUserById(user_id)
      const targetName = (targetUser?.user_metadata?.full_name ?? targetUser?.user_metadata?.user_name ?? 'Unknown') as string

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'user_kick',
        target_type: 'user',
        target_id: user_id,
        target_name: targetName,
        details: { reason },
      })

      await sc.from('pending_bot_actions').insert({
        action_type: 'kick_user',
        payload: { user_id, reason },
        created_by: user.id,
      })

      return jsonResponse({ success: true, action: 'kick_queued' })
    }

    if (action === 'timeout') {
      const { user_id, duration_minutes, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (!duration_minutes) return errorResponse('Missing duration_minutes', 400)
      if (user_id === user.id) return errorResponse('Cannot timeout yourself', 400)

      const timeoutUntil = new Date(Date.now() + duration_minutes * 60 * 1000).toISOString()

      const { error } = await sc.auth.admin.updateUserById(user_id, {
        user_metadata: { timeout_until: timeoutUntil },
      })
      if (error) return errorResponse(error.message, 500)

      const { data: { user: targetUser } } = await sc.auth.admin.getUserById(user_id)
      const targetName = (targetUser?.user_metadata?.full_name ?? targetUser?.user_metadata?.user_name ?? 'Unknown') as string

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'user_timeout',
        target_type: 'user',
        target_id: user_id,
        target_name: targetName,
        details: { duration_minutes, timeout_until: timeoutUntil, reason },
      })

      await sc.from('pending_bot_actions').insert({
        action_type: 'timeout_user',
        payload: { user_id, duration_minutes, reason },
        created_by: user.id,
      })

      return jsonResponse({ success: true, action: 'timed_out', timeout_until: timeoutUntil })
    }

    if (action === 'audit-log') {
      const page = body.page ?? 1
      const pageSize = body.pageSize ?? 20
      const from = (page - 1) * pageSize

      let query = supabaseClient
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (body.action_filter) {
        query = query.eq('action', body.action_filter)
      }
      if (body.target_type) {
        query = query.eq('target_type', body.target_type)
      }

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: list, update-role, ban, unban, kick, timeout, audit-log', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 6: Commit edge functions**

```bash
git add supabase/functions/manage-roles/ supabase/functions/manage-tickets/ supabase/functions/admin-overview/ supabase/functions/admin-settings/ supabase/functions/manage-users/index.ts
git commit -m "feat: add admin edge functions (roles, tickets, overview, settings, enhanced users)"
```

---

## Task 3: Update edgeFunctions.js

**Files:**
- Modify: `src/services/edgeFunctions.js`

- [ ] **Step 1: Add all new admin API functions**

Add the following new functions to the `edgeFunctions` object in `src/services/edgeFunctions.js`, after the existing admin section (after `updateUserRole`):

```javascript
  // Admin - User Actions
  banUser: (userId, reason) => invoke('manage-users', {
    action: 'ban',
    user_id: userId,
    reason,
  }),

  unbanUser: (userId) => invoke('manage-users', {
    action: 'unban',
    user_id: userId,
  }),

  kickUser: (userId, reason) => invoke('manage-users', {
    action: 'kick',
    user_id: userId,
    reason,
  }),

  timeoutUser: (userId, durationMinutes, reason) => invoke('manage-users', {
    action: 'timeout',
    user_id: userId,
    duration_minutes: durationMinutes,
    reason,
  }),

  getAuditLog: ({ page, pageSize, actionFilter, targetType } = {}) =>
    invoke('manage-users', {
      action: 'audit-log',
      page,
      pageSize,
      action_filter: actionFilter,
      target_type: targetType,
    }),

  // Admin - Roles
  listRoles: () => invoke('manage-roles', { action: 'list' }),

  createRole: ({ name, color, permissions, position }) =>
    invoke('manage-roles', { action: 'create', name, color, permissions, position }),

  updateRole: (id, { name, color, permissions, position }) =>
    invoke('manage-roles', { action: 'update', id, name, color, permissions, position }),

  deleteRole: (id) => invoke('manage-roles', { action: 'delete', id }),

  // Admin - Tickets
  listTickets: ({ page, pageSize, status } = {}) =>
    invoke('manage-tickets', { action: 'list', page, pageSize, status }),

  createTicket: ({ title, content, category, priority }) =>
    invoke('manage-tickets', { action: 'create', title, content, category, priority }),

  updateTicket: (id, { status, priority, assigned_to }) =>
    invoke('manage-tickets', { action: 'update', id, status, priority, assigned_to }),

  deleteTicket: (id) => invoke('manage-tickets', { action: 'delete', id }),

  replyTicket: (ticketId, content) =>
    invoke('manage-tickets', { action: 'reply', ticket_id: ticketId, content }),

  getTicketReplies: (ticketId) =>
    invoke('manage-tickets', { action: 'replies', ticket_id: ticketId }),

  // Admin - Overview
  getAdminOverview: () => invoke('admin-overview', {}),

  // Admin - Settings
  listSettings: () => invoke('admin-settings', { action: 'list' }),

  getSetting: (key) => invoke('admin-settings', { action: 'get', key }),

  updateSetting: (key, value) => invoke('admin-settings', { action: 'update', key, value }),

  batchUpdateSettings: (settings) =>
    invoke('admin-settings', { action: 'batch-update', settings }),
```

- [ ] **Step 2: Commit**

```bash
git add src/services/edgeFunctions.js
git commit -m "feat: add admin API functions to edgeFunctions client"
```

---

## Task 4: Frontend Components

**Files:**
- Create: `src/components/admin/UserActionDialog.jsx`
- Create: `src/components/admin/RoleDialog.jsx`
- Create: `src/components/admin/TicketDetailDialog.jsx`
- Create: `src/components/admin/TicketCreateDialog.jsx`
- Create: `src/components/admin/AuditLogTable.jsx`

- [ ] **Step 1: Create UserActionDialog**

```jsx
// src/components/admin/UserActionDialog.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

const TIMEOUT_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 hour' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: '7 days' },
]

export default function UserActionDialog({ open, onClose, actionType, targetUser, onConfirm }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm({
        actionType,
        userId: targetUser.id,
        reason,
        durationMinutes: duration,
      })
      setReason('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const titleMap = {
    ban: t('admin.users.actions.ban'),
    kick: t('admin.users.actions.kick'),
    timeout: t('admin.users.actions.timeout'),
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titleMap[actionType] ?? actionType}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {t('admin.users.actions.confirmTarget', { name: targetUser?.display_name ?? '' })}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.users.actions.reason')}
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mb: 2 }}
        />

        {actionType === 'timeout' && (
          <FormControl fullWidth>
            <InputLabel>{t('admin.users.actions.duration')}</InputLabel>
            <Select
              value={duration}
              label={t('admin.users.actions.duration')}
              onChange={(e) => setDuration(e.target.value)}
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create RoleDialog**

```jsx
// src/components/admin/RoleDialog.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'

export default function RoleDialog({ open, onClose, role, onSave }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#99AAB5')
  const [position, setPosition] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEdit = Boolean(role)

  useEffect(() => {
    if (role) {
      setName(role.name)
      setColor(role.color ?? '#99AAB5')
      setPosition(role.position ?? 0)
    } else {
      setName('')
      setColor('#99AAB5')
      setPosition(0)
    }
  }, [role, open])

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave({ id: role?.id, name: name.trim(), color, position })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? t('admin.roles.edit') : t('admin.roles.create')}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.roles.name')}
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            label={t('admin.roles.color')}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: color,
              border: 1,
              borderColor: 'divider',
              cursor: 'pointer',
            }}
            component="label"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
          </Box>
        </Box>

        <TextField
          label={t('admin.roles.position')}
          type="number"
          fullWidth
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || !name.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create TicketDetailDialog**

```jsx
// src/components/admin/TicketDetailDialog.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'

const STATUS_COLORS = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
}

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
}

export default function TicketDetailDialog({ open, onClose, ticket, onUpdate }) {
  const { t } = useTranslation()
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState(ticket?.status ?? 'open')
  const [priority, setPriority] = useState(ticket?.priority ?? 'normal')

  useEffect(() => {
    if (open && ticket) {
      setStatus(ticket.status)
      setPriority(ticket.priority)
      setLoadingReplies(true)
      edgeFunctions.getTicketReplies(ticket.id)
        .then((data) => setReplies(data ?? []))
        .catch(() => setReplies([]))
        .finally(() => setLoadingReplies(false))
    }
  }, [open, ticket])

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const reply = await edgeFunctions.replyTicket(ticket.id, replyText.trim())
      setReplies((prev) => [...prev, reply])
      setReplyText('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status: newStatus, priority })
      onUpdate({ ...ticket, status: newStatus, priority })
    } catch {
      setStatus(ticket.status)
    }
  }

  const handlePriorityChange = async (newPriority) => {
    setPriority(newPriority)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status, priority: newPriority })
      onUpdate({ ...ticket, status, priority: newPriority })
    } catch {
      setPriority(ticket.priority)
    }
  }

  if (!ticket) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>{ticket.title}</Typography>
          <Chip label={t(`admin.tickets.status.${ticket.status}`)} color={STATUS_COLORS[ticket.status]} size="small" />
          <Chip label={t(`admin.tickets.priority.${ticket.priority}`)} color={PRIORITY_COLORS[ticket.priority]} size="small" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Avatar src={ticket.author_avatar} sx={{ width: 24, height: 24 }}>
            {(ticket.author_name ?? '?')[0]}
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            {ticket.author_name} &middot; {new Date(ticket.created_at).toLocaleString()}
          </Typography>
          <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />
          <Chip label={ticket.source.toUpperCase()} size="small" variant="outlined" />
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{ticket.content}</Typography>
        </Paper>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('admin.tickets.statusLabel')}</InputLabel>
            <Select value={status} label={t('admin.tickets.statusLabel')} onChange={(e) => handleStatusChange(e.target.value)}>
              {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                <MenuItem key={s} value={s}>{t(`admin.tickets.status.${s}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('admin.tickets.priorityLabel')}</InputLabel>
            <Select value={priority} label={t('admin.tickets.priorityLabel')} onChange={(e) => handlePriorityChange(e.target.value)}>
              {['low', 'normal', 'high', 'urgent'].map((p) => (
                <MenuItem key={p} value={p}>{t(`admin.tickets.priority.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('admin.tickets.replies')}</Typography>

        {loadingReplies ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
        ) : (
          replies.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Avatar src={r.author_avatar} sx={{ width: 20, height: 20 }}>{(r.author_name ?? '?')[0]}</Avatar>
                <Typography variant="caption" color="text.secondary">
                  {r.author_name} &middot; {new Date(r.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.content}</Typography>
            </Paper>
          ))
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('admin.tickets.replyPlaceholder')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
          />
          <Button variant="contained" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
            {t('admin.tickets.send')}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create TicketCreateDialog**

```jsx
// src/components/admin/TicketCreateDialog.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'

export default function TicketCreateDialog({ open, onClose, onCreated }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onCreated({ title: title.trim(), content: content.trim(), category, priority })
      setTitle('')
      setContent('')
      setCategory('general')
      setPriority('normal')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('admin.tickets.create')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.tickets.titleLabel')}
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />

        <TextField
          label={t('admin.tickets.contentLabel')}
          fullWidth
          multiline
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>{t('admin.tickets.categoryLabel')}</InputLabel>
            <Select value={category} label={t('admin.tickets.categoryLabel')} onChange={(e) => setCategory(e.target.value)}>
              {['general', 'bug', 'request', 'report'].map((c) => (
                <MenuItem key={c} value={c}>{t(`admin.tickets.category.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t('admin.tickets.priorityLabel')}</InputLabel>
            <Select value={priority} label={t('admin.tickets.priorityLabel')} onChange={(e) => setPriority(e.target.value)}>
              {['low', 'normal', 'high', 'urgent'].map((p) => (
                <MenuItem key={p} value={p}>{t(`admin.tickets.priority.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleCreate} variant="contained" disabled={loading || !title.trim() || !content.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 5: Create AuditLogTable**

```jsx
// src/components/admin/AuditLogTable.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'

const ACTION_COLORS = {
  user_ban: 'error',
  user_kick: 'warning',
  user_timeout: 'warning',
  user_unban: 'success',
  role_change: 'info',
  role_create: 'success',
  role_update: 'info',
  role_delete: 'error',
  ticket_create: 'default',
  ticket_update: 'info',
  ticket_delete: 'error',
  setting_update: 'info',
}

export default function AuditLogTable({ compact = false, initialData = null }) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = async (p = 1, filter = '') => {
    setLoading(true)
    try {
      const data = await edgeFunctions.getAuditLog({
        page: p,
        pageSize: compact ? 5 : 20,
        actionFilter: filter || undefined,
      })
      setLogs(data ?? [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialData) {
      fetchLogs(page, actionFilter)
    }
  }, [page, actionFilter])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
  }

  return (
    <>
      {!compact && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('admin.audit.filterAction')}</InputLabel>
            <Select
              value={actionFilter}
              label={t('admin.audit.filterAction')}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            >
              <MenuItem value="">{t('feedback.all')}</MenuItem>
              <MenuItem value="user_ban">Ban</MenuItem>
              <MenuItem value="user_kick">Kick</MenuItem>
              <MenuItem value="user_timeout">Timeout</MenuItem>
              <MenuItem value="role_change">Role Change</MenuItem>
              <MenuItem value="role_create">Role Create</MenuItem>
              <MenuItem value="ticket_update">Ticket Update</MenuItem>
              <MenuItem value="setting_update">Setting Update</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.audit.time')}</TableCell>
              <TableCell>{t('admin.audit.actor')}</TableCell>
              <TableCell>{t('admin.audit.action')}</TableCell>
              <TableCell>{t('admin.audit.target')}</TableCell>
              {!compact && <TableCell>{t('admin.audit.details')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(log.created_at).toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>{log.actor_name}</TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={ACTION_COLORS[log.action] ?? 'default'} />
                </TableCell>
                <TableCell>{log.target_name ?? log.target_id}</TableCell>
                {!compact && (
                  <TableCell>
                    <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(log.details)}
                    </Typography>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={compact ? 4 : 5} align="center">
                  <Typography color="text.secondary">{t('admin.audit.empty')}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!compact && logs.length >= 20 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
          <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('admin.audit.prev')}
          </Button>
          <Button size="small" onClick={() => setPage((p) => p + 1)}>
            {t('admin.audit.next')}
          </Button>
        </Box>
      )}
    </>
  )
}
```

- [ ] **Step 6: Commit components**

```bash
git add src/components/admin/
git commit -m "feat: add admin UI components (UserAction, Role, Ticket, AuditLog dialogs)"
```

---

## Task 5: Rewrite Admin Pages

**Files:**
- Create: `src/pages/admin/Overview.jsx`
- Modify: `src/pages/admin/Roles.jsx`
- Modify: `src/pages/admin/Users.jsx`
- Modify: `src/pages/admin/Tickets.jsx`
- Modify: `src/pages/admin/FeedbackReview.jsx`
- Modify: `src/pages/admin/Settings.jsx`

- [ ] **Step 1: Create admin Overview page**

```jsx
// src/pages/admin/Overview.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import PeopleIcon from '@mui/icons-material/People'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import FeedbackIcon from '@mui/icons-material/Feedback'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import AuditLogTable from '../../components/admin/AuditLogTable'

export default function Overview() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    edgeFunctions.getAdminOverview()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  const statCards = [
    { icon: PeopleIcon, label: t('admin.overview.totalUsers'), value: stats?.total_users ?? 0, color: 'primary.main' },
    { icon: ConfirmationNumberIcon, label: t('admin.overview.openTickets'), value: stats?.open_tickets ?? 0, color: 'warning.main' },
    { icon: FeedbackIcon, label: t('admin.overview.openFeedback'), value: stats?.open_feedback ?? 0, color: 'info.main' },
    { icon: SmartToyIcon, label: t('admin.overview.pendingBotActions'), value: stats?.pending_bot_actions ?? 0, color: 'secondary.main' },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.overview.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <Grid size={{ xs: 6, md: 3 }} key={label}>
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Icon sx={{ fontSize: 40, color }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" sx={{ mb: 2 }}>{t('admin.overview.recentActivity')}</Typography>
      <AuditLogTable compact initialData={stats?.recent_audit ?? []} />
    </Container>
  )
}
```

- [ ] **Step 2: Rewrite Roles page**

Replace entire `src/pages/admin/Roles.jsx`:

```jsx
// src/pages/admin/Roles.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { edgeFunctions } from '../../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SyncIcon from '@mui/icons-material/Sync'
import RoleDialog from '../../components/admin/RoleDialog'

export default function Roles() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  const isAdmin = hasRole('admin')

  useEffect(() => {
    edgeFunctions.listRoles()
      .then((data) => setRoles(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async ({ id, name, color, position }) => {
    if (id) {
      const updated = await edgeFunctions.updateRole(id, { name, color, position })
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setNotice(t('admin.roles.updated'))
    } else {
      const created = await edgeFunctions.createRole({ name, color, position })
      setRoles((prev) => [...prev, created])
      setNotice(t('admin.roles.created'))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('admin.roles.confirmDelete'))) return
    try {
      await edgeFunctions.deleteRole(id)
      setRoles((prev) => prev.filter((r) => r.id !== id))
      setNotice(t('admin.roles.deleted'))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.roles.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.roles.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.roles.name')}</TableCell>
              <TableCell>{t('admin.roles.color')}</TableCell>
              <TableCell>{t('admin.roles.position')}</TableCell>
              <TableCell>{t('admin.roles.syncStatus')}</TableCell>
              {isAdmin && <TableCell align="right">{t('admin.roles.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.color }} />
                    {r.name}
                  </Box>
                </TableCell>
                <TableCell>{r.color}</TableCell>
                <TableCell>{r.position}</TableCell>
                <TableCell>
                  <Chip
                    icon={<SyncIcon />}
                    label={r.is_synced ? t('admin.roles.synced') : t('admin.roles.notSynced')}
                    size="small"
                    color={r.is_synced ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                {isAdmin && (
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setEditingRole(r); setDialogOpen(true) }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} align="center">
                  <Typography color="text.secondary">{t('admin.roles.empty')}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {isAdmin && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => { setEditingRole(null); setDialogOpen(true) }}
        >
          <AddIcon />
        </Fab>
      )}

      <RoleDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRole(null) }}
        role={editingRole}
        onSave={handleSave}
      />
    </Container>
  )
}
```

- [ ] **Step 3: Enhance Users page**

Replace entire `src/pages/admin/Users.jsx`:

```jsx
// src/pages/admin/Users.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import BlockIcon from '@mui/icons-material/Block'
import LogoutIcon from '@mui/icons-material/Logout'
import TimerIcon from '@mui/icons-material/Timer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import UserActionDialog from '../../components/admin/UserActionDialog'
import AuditLogTable from '../../components/admin/AuditLogTable'

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState(0)

  // Action dialog state
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, user: null })

  useEffect(() => {
    edgeFunctions.getUsers()
      .then((data) => setUsers(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(userId, newRole) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      setNotice(t('admin.users.roleUpdated'))
    } catch (err) {
      setNotice(err.message ?? t('admin.users.roleUpdateFailed'))
    }
  }

  async function handleAction({ actionType, userId, reason, durationMinutes }) {
    if (actionType === 'ban') {
      await edgeFunctions.banUser(userId, reason)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u)))
      setNotice(t('admin.users.actions.banned'))
    } else if (actionType === 'kick') {
      await edgeFunctions.kickUser(userId, reason)
      setNotice(t('admin.users.actions.kicked'))
    } else if (actionType === 'timeout') {
      const result = await edgeFunctions.timeoutUser(userId, durationMinutes, reason)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, timeout_until: result.timeout_until } : u)))
      setNotice(t('admin.users.actions.timedOut'))
    }
  }

  async function handleUnban(userId) {
    try {
      await edgeFunctions.unbanUser(userId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u)))
      setNotice(t('admin.users.actions.unbanned'))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('admin.users.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('admin.users.desc')}</Typography>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('admin.users.tabUsers')} />
        <Tab label={t('admin.users.tabAuditLog')} />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.users.name')}</TableCell>
                <TableCell>{t('admin.users.email')}</TableCell>
                <TableCell>{t('admin.users.currentRole')}</TableCell>
                <TableCell>{t('admin.users.status')}</TableCell>
                <TableCell>{t('admin.users.changeRole')}</TableCell>
                <TableCell align="right">{t('admin.users.actions.label')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                const isTimedOut = u.timeout_until && new Date(u.timeout_until) > new Date()

                return (
                  <TableRow key={u.id} sx={u.is_banned ? { opacity: 0.5 } : {}}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar src={u.avatar_url} sx={{ width: 32, height: 32 }}>{(u.display_name || '?')[0]}</Avatar>
                        {u.display_name}
                      </Box>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip label={t(`profile.roles.${u.role}`) || u.role} size="small"
                        color={u.role === 'admin' ? 'error' : u.role === 'moderator' ? 'warning' : 'primary'} />
                    </TableCell>
                    <TableCell>
                      {u.is_banned && <Chip label={t('admin.users.statusBanned')} size="small" color="error" />}
                      {isTimedOut && <Chip label={t('admin.users.statusTimeout')} size="small" color="warning" />}
                      {!u.is_banned && !isTimedOut && <Chip label={t('admin.users.statusActive')} size="small" color="success" />}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Typography variant="body2" color="text.secondary">{t('admin.users.self')}</Typography>
                      ) : (
                        <Select value={u.role} size="small" onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                          <MenuItem value="member">{t('profile.roles.member')}</MenuItem>
                          <MenuItem value="moderator">{t('profile.roles.moderator')}</MenuItem>
                          <MenuItem value="admin">{t('profile.roles.admin')}</MenuItem>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!isSelf && (
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {u.is_banned ? (
                            <Tooltip title={t('admin.users.actions.unban')}>
                              <IconButton size="small" color="success" onClick={() => handleUnban(u.id)}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <>
                              <Tooltip title={t('admin.users.actions.ban')}>
                                <IconButton size="small" color="error"
                                  onClick={() => setActionDialog({ open: true, type: 'ban', user: u })}>
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('admin.users.actions.kick')}>
                                <IconButton size="small" color="warning"
                                  onClick={() => setActionDialog({ open: true, type: 'kick', user: u })}>
                                  <LogoutIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('admin.users.actions.timeout')}>
                                <IconButton size="small"
                                  onClick={() => setActionDialog({ open: true, type: 'timeout', user: u })}>
                                  <TimerIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && <AuditLogTable />}

      <UserActionDialog
        open={actionDialog.open}
        onClose={() => setActionDialog({ open: false, type: null, user: null })}
        actionType={actionDialog.type}
        targetUser={actionDialog.user}
        onConfirm={handleAction}
      />
    </Container>
  )
}
```

- [ ] **Step 4: Rewrite Tickets page**

Replace entire `src/pages/admin/Tickets.jsx`:

```jsx
// src/pages/admin/Tickets.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import TicketDetailDialog from '../../components/admin/TicketDetailDialog'
import TicketCreateDialog from '../../components/admin/TicketCreateDialog'

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed']
const STATUS_COLORS = { open: 'info', in_progress: 'warning', resolved: 'success', closed: 'default' }
const PRIORITY_COLORS = { low: 'default', normal: 'info', high: 'warning', urgent: 'error' }

export default function Tickets() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [statusFilter, setStatusFilter] = useState(0)
  const [detailTicket, setDetailTicket] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  const isAdmin = hasRole('admin')

  const fetchTickets = (status) => {
    setLoading(true)
    edgeFunctions.listTickets({ status: status === 'all' ? undefined : status })
      .then((data) => setTickets(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTickets(STATUS_TABS[statusFilter])
  }, [statusFilter])

  const handleCreate = async (ticketData) => {
    const created = await edgeFunctions.createTicket(ticketData)
    setTickets((prev) => [created, ...prev])
    setNotice(t('admin.tickets.created'))
  }

  const handleUpdate = (updated) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  const handleDelete = async (id) => {
    if (!confirm(t('admin.tickets.confirmDelete'))) return
    try {
      await edgeFunctions.deleteTicket(id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      setNotice(t('admin.tickets.deleted'))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.tickets.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.tickets.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={statusFilter} onChange={(_, v) => setStatusFilter(v)} sx={{ mb: 2 }}>
        {STATUS_TABS.map((s) => (
          <Tab key={s} label={t(`admin.tickets.status.${s}`)} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.tickets.titleLabel')}</TableCell>
                <TableCell>{t('admin.tickets.author')}</TableCell>
                <TableCell>{t('admin.tickets.categoryLabel')}</TableCell>
                <TableCell>{t('admin.tickets.priorityLabel')}</TableCell>
                <TableCell>{t('admin.tickets.statusLabel')}</TableCell>
                <TableCell>{t('admin.tickets.date')}</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailTicket(ticket)}
                >
                  <TableCell>{ticket.title}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={ticket.author_avatar} sx={{ width: 24, height: 24 }}>
                        {(ticket.author_name ?? '?')[0]}
                      </Avatar>
                      {ticket.author_name}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.priority.${ticket.priority}`)} size="small" color={PRIORITY_COLORS[ticket.priority]} />
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.status.${ticket.status}`)} size="small" color={STATUS_COLORS[ticket.status]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{new Date(ticket.created_at).toLocaleDateString()}</Typography>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id) }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} align="center">
                    <Typography color="text.secondary">{t('admin.tickets.empty')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Fab color="primary" sx={{ position: 'fixed', bottom: 24, right: 24 }} onClick={() => setCreateOpen(true)}>
        <AddIcon />
      </Fab>

      <TicketDetailDialog
        open={Boolean(detailTicket)}
        onClose={() => setDetailTicket(null)}
        ticket={detailTicket}
        onUpdate={handleUpdate}
      />

      <TicketCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreate}
      />
    </Container>
  )
}
```

- [ ] **Step 5: Rewrite FeedbackReview page**

Replace entire `src/pages/admin/FeedbackReview.jsx`:

```jsx
// src/pages/admin/FeedbackReview.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import DeleteIcon from '@mui/icons-material/Delete'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'

const CATEGORY_TABS = ['all', 'feature', 'event', 'bug']
const STATUS_COLORS = { open: 'info', reviewed: 'warning', accepted: 'success', rejected: 'error' }
const CATEGORY_COLORS = { feature: 'primary', event: 'secondary', bug: 'error' }

export default function FeedbackReview() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [categoryTab, setCategoryTab] = useState(0)

  const isAdmin = hasRole('admin')

  const fetchFeedbacks = (category) => {
    setLoading(true)
    edgeFunctions.listFeedbacks({ category: category === 'all' ? undefined : category })
      .then((data) => setFeedbacks(data?.feedbacks ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFeedbacks(CATEGORY_TABS[categoryTab])
  }, [categoryTab])

  const handleStatusChange = async (id, newStatus) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, newStatus)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)))
      setNotice(t('admin.feedbackReview.statusUpdated'))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id)
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      setNotice(t('feedback.deleted'))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.feedbackReview.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.feedbackReview.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={categoryTab} onChange={(_, v) => setCategoryTab(v)} sx={{ mb: 2 }}>
        {CATEGORY_TABS.map((c) => (
          <Tab key={c} label={c === 'all' ? t('feedback.all') : t(`feedback.${c}`)} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('feedback.titleLabel')}</TableCell>
                <TableCell>{t('feedback.categoryLabel')}</TableCell>
                <TableCell><ThumbUpIcon fontSize="small" /></TableCell>
                <TableCell>{t('admin.feedbackReview.currentStatus')}</TableCell>
                <TableCell>{t('feedback.changeStatus')}</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {feedbacks.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.content}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`feedback.${f.category}`)} size="small" color={CATEGORY_COLORS[f.category] ?? 'default'} />
                  </TableCell>
                  <TableCell>{f.vote_count ?? 0}</TableCell>
                  <TableCell>
                    <Chip label={t(`feedback.status.${f.status}`)} size="small" color={STATUS_COLORS[f.status]} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={f.status}
                      size="small"
                      onChange={(e) => handleStatusChange(f.id, e.target.value)}
                    >
                      {['open', 'reviewed', 'accepted', 'rejected'].map((s) => (
                        <MenuItem key={s} value={s}>{t(`feedback.status.${s}`)}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => handleDelete(f.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {feedbacks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} align="center">
                    <Typography color="text.secondary">{t('feedback.empty')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
```

- [ ] **Step 6: Rewrite Settings page**

Replace entire `src/pages/admin/Settings.jsx`:

```jsx
// src/pages/admin/Settings.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import SaveIcon from '@mui/icons-material/Save'

const SETTING_GROUPS = [
  {
    titleKey: 'admin.settings.server',
    keys: ['discord_server_id', 'site_name', 'site_description'],
  },
  {
    titleKey: 'admin.settings.access',
    keys: ['allowed_roles'],
  },
  {
    titleKey: 'admin.settings.tickets',
    keys: ['ticket_discord_channel', 'ticket_visible_roles', 'ticket_auto_categories'],
  },
  {
    titleKey: 'admin.settings.notifications',
    keys: ['notify_new_ticket', 'notify_new_feedback', 'notify_new_user', 'notification_webhook_url'],
  },
]

export default function Settings() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const isAdmin = hasRole('admin')

  useEffect(() => {
    edgeFunctions.listSettings()
      .then((data) => {
        const map = {}
        for (const s of (data ?? [])) {
          map[s.key] = s.value
        }
        setSettings(map)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const batch = Object.entries(settings).map(([key, value]) => ({ key, value }))
      await edgeFunctions.batchUpdateSettings(batch)
      setNotice(t('admin.settings.saved'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderField = (key) => {
    const value = settings[key]

    // Boolean toggles
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      const boolVal = value === true || value === 'true'
      return (
        <FormControlLabel
          key={key}
          control={<Switch checked={boolVal} onChange={(e) => handleChange(key, e.target.checked)} disabled={!isAdmin} />}
          label={t(`admin.settings.keys.${key}`)}
          sx={{ display: 'block', mb: 1 }}
        />
      )
    }

    // Arrays (JSON string representation)
    if (Array.isArray(value)) {
      return (
        <TextField
          key={key}
          label={t(`admin.settings.keys.${key}`)}
          fullWidth
          value={JSON.stringify(value)}
          onChange={(e) => {
            try {
              handleChange(key, JSON.parse(e.target.value))
            } catch {
              // allow invalid JSON while typing
            }
          }}
          disabled={!isAdmin}
          helperText="JSON array format"
          sx={{ mb: 2 }}
        />
      )
    }

    // String values
    return (
      <TextField
        key={key}
        label={t(`admin.settings.keys.${key}`)}
        fullWidth
        value={typeof value === 'string' ? value : JSON.stringify(value)}
        onChange={(e) => handleChange(key, e.target.value)}
        disabled={!isAdmin}
        sx={{ mb: 2 }}
      />
    )
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.settings.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.settings.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {SETTING_GROUPS.map(({ titleKey, keys }) => (
        <Card key={titleKey} variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t(titleKey)}</Typography>
            {keys.map(renderField)}
          </CardContent>
        </Card>
      ))}

      {isAdmin && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </Box>
        </>
      )}
    </Container>
  )
}
```

- [ ] **Step 7: Commit pages**

```bash
git add src/pages/admin/
git commit -m "feat: rewrite admin pages (overview, roles, users, tickets, feedback, settings)"
```

---

## Task 6: Update Routing & Navigation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/NavRail.jsx`

- [ ] **Step 1: Add Overview route and import to App.jsx**

Add import at top of `src/App.jsx`:
```jsx
import Overview from './pages/admin/Overview'
```

Add the Overview route as the first admin route (index route):
```jsx
{/* Admin routes (moderator+) */}
<Route element={<ProtectedRoute minimumRole="moderator" />}>
  <Route path="/admin" element={<Overview />} />
  <Route path="/admin/roles" element={<Roles />} />
  ...
```

- [ ] **Step 2: Add Overview to NavRail**

In `src/components/NavRail.jsx`, add an import and a new nav item:

Add import:
```jsx
import DashboardIcon from '@mui/icons-material/Dashboard'
```

Add as first item in `ADMIN_NAV` array:
```jsx
{ key: 'nav.admin.overview', path: '/admin', icon: DashboardIcon },
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/components/NavRail.jsx
git commit -m "feat: add admin overview route and navigation"
```

---

## Task 7: Update i18n Locale Files

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/zh-TW.json`

- [ ] **Step 1: Add admin i18n keys to all locale files**

Add the following keys to each locale file (shown here in English — translate for ja, zh-CN, zh-TW):

```json
{
  "nav.admin.overview": "Overview",

  "admin.overview.title": "Admin Dashboard",
  "admin.overview.totalUsers": "Total Users",
  "admin.overview.openTickets": "Open Tickets",
  "admin.overview.openFeedback": "Open Feedback",
  "admin.overview.pendingBotActions": "Pending Bot Actions",
  "admin.overview.recentActivity": "Recent Activity",

  "admin.roles.title": "Role Management",
  "admin.roles.desc": "Manage Discord roles and sync with your server",
  "admin.roles.name": "Name",
  "admin.roles.color": "Color",
  "admin.roles.position": "Position",
  "admin.roles.syncStatus": "Sync Status",
  "admin.roles.synced": "Synced",
  "admin.roles.notSynced": "Not Synced",
  "admin.roles.actions": "Actions",
  "admin.roles.create": "Create Role",
  "admin.roles.edit": "Edit Role",
  "admin.roles.created": "Role created",
  "admin.roles.updated": "Role updated",
  "admin.roles.deleted": "Role deleted",
  "admin.roles.confirmDelete": "Delete this role?",
  "admin.roles.empty": "No roles yet",

  "admin.users.tabUsers": "Users",
  "admin.users.tabAuditLog": "Audit Log",
  "admin.users.status": "Status",
  "admin.users.statusActive": "Active",
  "admin.users.statusBanned": "Banned",
  "admin.users.statusTimeout": "Timed Out",
  "admin.users.actions.label": "Actions",
  "admin.users.actions.ban": "Ban",
  "admin.users.actions.unban": "Unban",
  "admin.users.actions.kick": "Kick",
  "admin.users.actions.timeout": "Timeout",
  "admin.users.actions.confirmTarget": "Are you sure you want to perform this action on {{name}}?",
  "admin.users.actions.reason": "Reason",
  "admin.users.actions.duration": "Duration",
  "admin.users.actions.banned": "User has been banned",
  "admin.users.actions.unbanned": "User has been unbanned",
  "admin.users.actions.kicked": "Kick action queued for Discord bot",
  "admin.users.actions.timedOut": "User has been timed out",

  "admin.tickets.title": "Tickets",
  "admin.tickets.desc": "Manage support tickets from web and Discord",
  "admin.tickets.titleLabel": "Title",
  "admin.tickets.contentLabel": "Content",
  "admin.tickets.categoryLabel": "Category",
  "admin.tickets.priorityLabel": "Priority",
  "admin.tickets.statusLabel": "Status",
  "admin.tickets.author": "Author",
  "admin.tickets.date": "Date",
  "admin.tickets.create": "New Ticket",
  "admin.tickets.created": "Ticket created",
  "admin.tickets.deleted": "Ticket deleted",
  "admin.tickets.confirmDelete": "Delete this ticket?",
  "admin.tickets.empty": "No tickets",
  "admin.tickets.replies": "Replies",
  "admin.tickets.replyPlaceholder": "Type a reply...",
  "admin.tickets.send": "Send",
  "admin.tickets.status.all": "All",
  "admin.tickets.status.open": "Open",
  "admin.tickets.status.in_progress": "In Progress",
  "admin.tickets.status.resolved": "Resolved",
  "admin.tickets.status.closed": "Closed",
  "admin.tickets.priority.low": "Low",
  "admin.tickets.priority.normal": "Normal",
  "admin.tickets.priority.high": "High",
  "admin.tickets.priority.urgent": "Urgent",
  "admin.tickets.category.general": "General",
  "admin.tickets.category.bug": "Bug",
  "admin.tickets.category.request": "Request",
  "admin.tickets.category.report": "Report",

  "admin.feedbackReview.title": "Feedback Review",
  "admin.feedbackReview.desc": "Review and manage community feedback",
  "admin.feedbackReview.currentStatus": "Current Status",
  "admin.feedbackReview.statusUpdated": "Status updated",

  "admin.settings.title": "System Settings",
  "admin.settings.desc": "Configure dashboard, Discord integration, and notifications",
  "admin.settings.server": "Server Settings",
  "admin.settings.access": "Access Control",
  "admin.settings.tickets": "Ticket Settings",
  "admin.settings.notifications": "Notifications",
  "admin.settings.saved": "Settings saved",
  "admin.settings.keys.discord_server_id": "Discord Server ID",
  "admin.settings.keys.site_name": "Site Name",
  "admin.settings.keys.site_description": "Site Description",
  "admin.settings.keys.allowed_roles": "Allowed Roles (JSON)",
  "admin.settings.keys.ticket_discord_channel": "Ticket Discord Channel ID",
  "admin.settings.keys.ticket_visible_roles": "Ticket Visible Roles (JSON)",
  "admin.settings.keys.ticket_auto_categories": "Ticket Categories (JSON)",
  "admin.settings.keys.notify_new_ticket": "Notify on New Ticket",
  "admin.settings.keys.notify_new_feedback": "Notify on New Feedback",
  "admin.settings.keys.notify_new_user": "Notify on New User",
  "admin.settings.keys.notification_webhook_url": "Notification Webhook URL",

  "admin.audit.filterAction": "Filter by Action",
  "admin.audit.time": "Time",
  "admin.audit.actor": "Actor",
  "admin.audit.action": "Action",
  "admin.audit.target": "Target",
  "admin.audit.details": "Details",
  "admin.audit.empty": "No audit logs",
  "admin.audit.prev": "Previous",
  "admin.audit.next": "Next"
}
```

Translations for ja, zh-CN, zh-TW should be done by the implementing agent using the same keys with translated values.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add admin dashboard i18n keys (en, ja, zh-CN, zh-TW)"
```

---

## Task 8: Build Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors (warnings OK).

- [ ] **Step 3: Fix any issues found and re-run**

If build or lint fails, fix the issues and re-commit.

- [ ] **Step 4: Final commit and push**

```bash
git push
```
