# Dual Authentication Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RLS + Edge Functions dual-layer security with role-based access control (admin/moderator/member) to the SusLab web platform.

**Architecture:** Supabase RLS protects data at the database level. Supabase Edge Functions verify JWTs and check roles before querying. Frontend uses `supabase.functions.invoke()` instead of direct DB queries. A custom access token hook injects roles into JWTs. Since `supabase.functions.invoke()` always sends POST, Edge Functions use action-based routing via a `body.action` field.

**Tech Stack:** Supabase (Auth, RLS, Edge Functions), React 19, Vite, react-router-dom v7

**Spec:** `docs/superpowers/specs/2026-03-23-dual-auth-security-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/001_user_roles.sql` | user_roles table, triggers, custom access token hook, permissions |
| `supabase/migrations/002_rls_policies.sql` | RLS policies for events and user_roles tables |
| `supabase/functions/_shared/cors.ts` | Shared CORS headers |
| `supabase/functions/_shared/auth.ts` | Shared JWT verification + role checking middleware |
| `supabase/functions/get-events/index.ts` | Edge Function: fetch events (member+) |
| `supabase/functions/manage-events/index.ts` | Edge Function: create/update/delete events (moderator+) |
| `supabase/functions/get-profile/index.ts` | Edge Function: fetch own profile (member+) |
| `supabase/functions/manage-users/index.ts` | Edge Function: list users + change roles (admin) |
| `src/components/ProtectedRoute.jsx` | Route guard with role checking |
| `src/services/edgeFunctions.js` | Frontend Edge Functions client |
| `src/pages/Admin.jsx` | Admin panel page |
| `src/pages/Admin.css` | Admin panel styles |

### Modified files

| File | Changes |
|------|---------|
| `src/context/AuthContext.jsx` | Add `role` state, `hasRole()` utility |
| `src/App.jsx` | Wrap routes with ProtectedRoute, add Admin route |
| `src/components/Navbar.jsx` | Role-based menu visibility, admin link |
| `src/components/Navbar.css` | Admin link badge style |
| `src/pages/Dashboard.jsx` | Replace direct Supabase query with Edge Function |
| `src/pages/Profile.jsx` | Display role from Edge Function, defensive null checks |

---

## Task 1: Database Migration — user_roles Table & Hooks

**Files:**
- Create: `supabase/migrations/001_user_roles.sql`

**Context:** This SQL is run in the Supabase SQL Editor (Dashboard > SQL Editor). It creates the user_roles table, a trigger to auto-assign 'member' role on signup, an updated_at trigger, and the custom access token hook that injects the role into JWTs.

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================
-- 001_user_roles.sql
-- Creates user_roles table, triggers, and
-- custom access token hook
-- ============================================

-- 1. Create user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_user_id_unique unique (user_id)
);

-- 2. Auto-update updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_user_roles_updated
  before update on public.user_roles
  for each row execute procedure public.handle_updated_at();

-- 3. Auto-assign member role on signup
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'member');
  return new;
end;
$$;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();

-- 4. Custom access token hook (injects role into JWT)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  claims jsonb;
  user_role text;
begin
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Ensure app_metadata exists
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- Inject role (default to 'member' if not found)
  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(user_role, 'member'))
  );

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- 5. Grant permissions to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant all on table public.user_roles to supabase_auth_admin;

-- 6. Revoke direct access from public-facing roles
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- 7. Backfill: create member roles for existing users who don't have one
insert into public.user_roles (user_id, role)
select id, 'member' from auth.users
where id not in (select user_id from public.user_roles)
on conflict (user_id) do nothing;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

1. Go to Supabase Dashboard > SQL Editor
2. Paste the contents of `001_user_roles.sql`
3. Click "Run"
4. Expected: "Success. No rows returned" (no errors)

- [ ] **Step 3: Register the hook in Supabase Dashboard**

1. Go to Authentication > Hooks
2. Find "Customize Access Token (JWT) Claims"
3. Toggle ON
4. Select hook type: Postgres Function
5. Select schema: public
6. Select function: custom_access_token_hook
7. Save

- [ ] **Step 4: Verify the hook works**

1. Sign out from the app
2. Sign in again with Discord
3. In browser DevTools console, run:
   ```js
   const { data } = await supabase.auth.getSession()
   console.log(data.session.access_token)
   ```
4. Decode the JWT at jwt.io — verify `app_metadata.role` is `"member"`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_user_roles.sql
git commit -m "feat: add user_roles table, triggers, and custom access token hook"
```

---

## Task 2: Database Migration — RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Create the RLS policies migration file**

```sql
-- ============================================
-- 002_rls_policies.sql
-- RLS policies for events and user_roles tables
-- ============================================

-- ---- events table ----

alter table public.events enable row level security;

-- SELECT: any authenticated user
create policy "events_select_authenticated"
on public.events for select
to authenticated
using (true);

-- INSERT: moderator or admin
create policy "events_insert_moderator"
on public.events for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- UPDATE: moderator or admin
create policy "events_update_moderator"
on public.events for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

-- DELETE: admin only
create policy "events_delete_admin"
on public.events for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ---- user_roles table ----

alter table public.user_roles enable row level security;

-- SELECT: own role or admin sees all
create policy "user_roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- UPDATE: admin only
create policy "user_roles_update_admin"
on public.user_roles for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- DELETE: admin only
create policy "user_roles_delete_admin"
on public.user_roles for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- No INSERT policy: deny by default.
-- Only the SECURITY DEFINER trigger can insert rows.
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

1. Go to Supabase Dashboard > SQL Editor
2. Paste the contents of `002_rls_policies.sql`
3. Click "Run"
4. Expected: "Success. No rows returned"

- [ ] **Step 3: Verify RLS is active**

1. Go to Table Editor > events — verify RLS is enabled (shield icon)
2. Go to Table Editor > user_roles — verify RLS is enabled

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_rls_policies.sql
git commit -m "feat: add RLS policies for events and user_roles tables"
```

---

## Task 3: Edge Functions — Shared Utilities

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/auth.ts`

- [ ] **Step 1: Create CORS headers utility**

Create `supabase/functions/_shared/cors.ts`:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

- [ ] **Step 2: Create auth middleware**

Create `supabase/functions/_shared/auth.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

const ROLE_LEVELS: Record<string, number> = {
  member: 1,
  moderator: 2,
  admin: 3,
}

export interface AuthResult {
  user: {
    id: string
    email?: string
    app_metadata: Record<string, unknown>
    user_metadata: Record<string, unknown>
  }
  role: string
  supabaseClient: ReturnType<typeof createClient>
}

export function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

export async function verifyAuth(req: Request, minimumRole: string): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw { message: 'Missing Authorization header', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')

  // Create a service-level client for token verification only
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: { user }, error } = await serviceClient.auth.getUser(token)
  if (error || !user) {
    throw { message: 'Invalid or expired token', status: 401 }
  }

  const role = (user.app_metadata?.role as string) ?? 'member'
  const userLevel = ROLE_LEVELS[role] ?? 0
  const requiredLevel = ROLE_LEVELS[minimumRole] ?? 0

  if (userLevel < requiredLevel) {
    throw { message: `權限不足。需要: ${minimumRole}，目前: ${role}`, status: 403 }
  }

  // Create user-scoped client (RLS active)
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    },
  )

  return { user, role, supabaseClient }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/auth.ts
git commit -m "feat: add shared CORS and auth middleware for Edge Functions"
```

---

## Task 4: Edge Function — get-events

**Files:**
- Create: `supabase/functions/get-events/index.ts`

**Note:** `supabase.functions.invoke()` always sends POST. This function only handles one action so no action routing needed.

- [ ] **Step 1: Create get-events Edge Function**

Create `supabase/functions/get-events/index.ts`:

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await verifyAuth(req, 'member')

    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('date', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse(data)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/get-events/index.ts
git commit -m "feat: add get-events Edge Function"
```

---

## Task 5: Edge Function — manage-events

**Files:**
- Create: `supabase/functions/manage-events/index.ts`

**Note:** Uses `body.action` field for routing since `supabase.functions.invoke()` always sends POST. Actions: `create`, `update`, `delete`.

- [ ] **Step 1: Create manage-events Edge Function**

Create `supabase/functions/manage-events/index.ts`:

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient, role } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { title, description, date, time, location, attendees } = body
      const { data, error } = await supabaseClient
        .from('events')
        .insert({ title, description, date, time, location, attendees: attendees ?? 0 })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const { id, ...updates } = body
      delete updates.action
      if (!id) return errorResponse('Missing event id', 400)

      const { data, error } = await supabaseClient
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') {
        return errorResponse('只有 Admin 可以刪除活動', 403)
      }

      const { id } = body
      if (!id) return errorResponse('Missing event id', 400)

      const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/manage-events/index.ts
git commit -m "feat: add manage-events Edge Function"
```

---

## Task 6: Edge Function — get-profile

**Files:**
- Create: `supabase/functions/get-profile/index.ts`

- [ ] **Step 1: Create get-profile Edge Function**

Create `supabase/functions/get-profile/index.ts`:

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    return jsonResponse({
      id: user.id,
      email: user.email,
      role: roleData?.role ?? role,
      user_metadata: user.user_metadata,
      created_at: user.user_metadata?.created_at ?? null,
      role_since: roleData?.updated_at ?? null,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/get-profile/index.ts
git commit -m "feat: add get-profile Edge Function"
```

---

## Task 7: Edge Function — manage-users

**Files:**
- Create: `supabase/functions/manage-users/index.ts`

**Note:** Uses `body.action` field: `list` (list all users) or `update-role` (change a user's role).

- [ ] **Step 1: Create manage-users Edge Function**

Create `supabase/functions/manage-users/index.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, supabaseClient } = await verifyAuth(req, 'admin')
    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      // Admin needs to see all users — use service_role for auth.users listing
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers()
      if (usersError) return errorResponse(usersError.message, 500)

      // Get all roles (admin can read all via RLS)
      const { data: roles, error: rolesError } = await supabaseClient
        .from('user_roles')
        .select('user_id, role, updated_at')

      if (rolesError) return errorResponse(rolesError.message, 500)

      const roleMap = new Map(roles?.map((r: { user_id: string; role: string; updated_at: string }) => [r.user_id, r]) ?? [])

      const userList = users.map((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string }) => ({
        id: u.id,
        email: u.email,
        display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
        avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
        role: (roleMap.get(u.id) as { role: string } | undefined)?.role ?? 'member',
        role_updated_at: (roleMap.get(u.id) as { updated_at: string } | undefined)?.updated_at ?? null,
        created_at: u.created_at,
      }))

      return jsonResponse(userList)
    }

    if (action === 'update-role') {
      const { user_id, role } = body

      if (!user_id || !role) {
        return errorResponse('Missing user_id or role', 400)
      }

      if (!['admin', 'moderator', 'member'].includes(role)) {
        return errorResponse('無效的角色。必須是 admin、moderator 或 member', 400)
      }

      // Prevent admin from demoting themselves
      if (user_id === user.id) {
        return errorResponse('無法變更自己的角色', 400)
      }

      const { data, error } = await supabaseClient
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      return jsonResponse({
        ...data,
        notice: '角色已更新。該用戶需要重新登入才會生效。',
      })
    }

    return errorResponse('Invalid action. Use: list, update-role', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/manage-users/index.ts
git commit -m "feat: add manage-users Edge Function"
```

---

## Task 8: Frontend — AuthContext with Role Support

**Files:**
- Modify: `src/context/AuthContext.jsx`

- [ ] **Step 1: Update AuthContext to include role and hasRole()**

Replace the entire contents of `src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext(null)

const ROLE_LEVELS = { member: 1, moderator: 2, admin: 3 }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  function extractRole(user) {
    return user?.app_metadata?.role ?? 'member'
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setRole(session?.user ? extractRole(session.user) : null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setRole(session?.user ? extractRole(session.user) : null)
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const hasRole = (minimumRole) => {
    if (!role) return false
    return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[minimumRole] ?? 0)
  }

  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) console.error('Discord login error:', error.message)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error.message)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, hasRole, signInWithDiscord, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: add role state and hasRole() to AuthContext"
```

---

## Task 9: Frontend — Edge Functions Client

**Files:**
- Create: `src/services/edgeFunctions.js`

**Note:** `supabase.functions.invoke()` always sends POST and automatically attaches the user's auth token. Action routing is done via `body.action` field.

- [ ] **Step 1: Create Edge Functions client**

Create `src/services/edgeFunctions.js`:

```javascript
import { supabase } from './supabaseClient'

async function invoke(functionName, body = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    // Try to parse error response body for structured errors
    let parsed = null
    if (error.context?.body) {
      try {
        const text = await new Response(error.context.body).text()
        parsed = JSON.parse(text)
      } catch {
        // ignore parse errors
      }
    }

    const message = parsed?.error ?? error.message ?? 'Unknown error'
    const status = error.context?.status ?? 500
    throw { message, status }
  }

  return data
}

export const edgeFunctions = {
  // Events
  getEvents: () => invoke('get-events'),

  createEvent: (event) => invoke('manage-events', {
    action: 'create',
    ...event,
  }),

  updateEvent: (id, updates) => invoke('manage-events', {
    action: 'update',
    id,
    ...updates,
  }),

  deleteEvent: (id) => invoke('manage-events', {
    action: 'delete',
    id,
  }),

  // Profile
  getProfile: () => invoke('get-profile'),

  // Admin
  getUsers: () => invoke('manage-users', { action: 'list' }),

  updateUserRole: (userId, role) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
  }),
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/edgeFunctions.js
git commit -m "feat: add Edge Functions client service"
```

---

## Task 10: Frontend — ProtectedRoute Component

**Files:**
- Create: `src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Create ProtectedRoute component**

Create `src/components/ProtectedRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minimumRole = 'member' }) {
  const { user, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!hasRole(minimumRole)) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>權限不足</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            需要 <strong>{minimumRole}</strong> 權限才能存取此頁面。
          </p>
        </div>
      </div>
    )
  }

  return children
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProtectedRoute.jsx
git commit -m "feat: add ProtectedRoute component with role checking"
```

---

## Task 11: Frontend — Update App.jsx Routes

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update App.jsx to use ProtectedRoute and add Admin route**

Replace the entire contents of `src/App.jsx`:

```jsx
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AuthCallback from './pages/AuthCallback'

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute minimumRole="member">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute minimumRole="member">
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute minimumRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wrap routes with ProtectedRoute and add admin route"
```

---

## Task 12: Frontend — Update Dashboard to Use Edge Function

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Replace direct Supabase query with Edge Function call**

Replace the entire contents of `src/pages/Dashboard.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin } from 'lucide-react'
import { edgeFunctions } from '../services/edgeFunctions'
import './Dashboard.css'

function Dashboard() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await edgeFunctions.getEvents()
        setEvents(data ?? [])
      } catch (err) {
        console.error('Failed to fetch events:', err)
        setError(err.message ?? '無法載入活動')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>活動紀錄</h2>
            <p>社群近期與即將舉辦的活動</p>
          </div>

          {loading ? (
            <div className="loading-grid grid-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card skeleton-card">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text short" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>目前沒有活動</p>
            </div>
          ) : (
            <div className="grid-3">
              {events.map((event) => (
                <div key={event.id} className="card event-card">
                  <div className="event-date-badge">
                    <Calendar size={14} />
                    {event.date}
                  </div>
                  <h3>{event.title}</h3>
                  <p className="event-desc">{event.description}</p>
                  <div className="event-meta">
                    <span>
                      <Clock size={14} />
                      {event.time}
                    </span>
                    <span>
                      <MapPin size={14} />
                      {event.location}
                    </span>
                    <span>
                      <Users size={14} />
                      {event.attendees} 人參加
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: use Edge Function for events data instead of direct Supabase query"
```

---

## Task 13: Frontend — Update Profile to Use Edge Function & Show Role

**Files:**
- Modify: `src/pages/Profile.jsx`

- [ ] **Step 1: Update Profile to call get-profile Edge Function and display role**

Replace the entire contents of `src/pages/Profile.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { LogOut, Shield, Calendar, Mail, Award } from 'lucide-react'
import './Profile.css'

const ROLE_LABELS = {
  admin: '管理員',
  moderator: '版主',
  member: '成員',
}

export default function Profile() {
  const { user, role, loading, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    if (user) {
      edgeFunctions.getProfile()
        .then(setProfileData)
        .catch((err) => console.error('Failed to fetch profile:', err))
    }
  }, [user])

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) return null

  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || meta.name || '社群成員'
  const username = meta.user_name || meta.preferred_username
  const email = profileData?.email ?? meta.email ?? user.email
  const displayRole = profileData?.role ?? role
  const createdAt = new Date(user.created_at).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar-wrapper">
                {avatar ? (
                  <img src={avatar} alt={displayName} className="profile-avatar" />
                ) : (
                  <div className="profile-avatar profile-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="profile-badge">
                  <Shield size={14} />
                </div>
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{displayName}</h1>
                {username && <p className="profile-username">@{username}</p>}
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-detail-item">
                <Award size={18} />
                <span>角色：{ROLE_LABELS[displayRole] ?? displayRole}</span>
              </div>
              {email && (
                <div className="profile-detail-item">
                  <Mail size={18} />
                  <span>{email}</span>
                </div>
              )}
              <div className="profile-detail-item">
                <Calendar size={18} />
                <span>加入日期：{createdAt}</span>
              </div>
              <div className="profile-detail-item">
                <Shield size={18} />
                <span>透過 Discord 驗證</span>
              </div>
            </div>

            <div className="profile-actions">
              <button onClick={signOut} className="btn btn-danger">
                <LogOut size={18} />
                登出
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Profile.jsx
git commit -m "feat: use Edge Function for profile data and display user role"
```

---

## Task 14: Frontend — Update Navbar with Role-Based Visibility

**Files:**
- Modify: `src/components/Navbar.jsx`
- Modify: `src/components/Navbar.css`

- [ ] **Step 1: Update Navbar to show admin link and role-based menu items**

Replace the entire contents of `src/components/Navbar.jsx`:

```jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Leaf, Menu, X, LogIn, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { user, loading, hasRole, signInWithDiscord } = useAuth()

  const links = [
    { to: '/', label: '首頁', public: true },
    { to: '/dashboard', label: '活動紀錄', public: false },
  ]

  const meta = user?.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || '會員'

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">
          <Leaf size={24} />
          <span>SusLab</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map((link) => {
            if (!link.public && !user) return null
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`navbar-link ${location.pathname === link.to ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}

          {user && hasRole('admin') && (
            <Link
              to="/admin"
              className={`navbar-link navbar-admin-link ${location.pathname === '/admin' ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={14} />
              管理後台
            </Link>
          )}

          {!loading && (
            user ? (
              <Link
                to="/profile"
                className="navbar-user"
                onClick={() => setMenuOpen(false)}
              >
                {avatar ? (
                  <img src={avatar} alt={displayName} className="navbar-avatar" />
                ) : (
                  <div className="navbar-avatar navbar-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="navbar-username">{displayName}</span>
              </Link>
            ) : (
              <button onClick={signInWithDiscord} className="btn btn-primary navbar-cta">
                <LogIn size={16} />
                Discord 登入
              </button>
            )
          )}
        </div>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '關閉選單' : '開啟選單'}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  )
}

export default Navbar
```

- [ ] **Step 2: Replace the entire contents of `src/components/Navbar.css`**

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(236, 253, 245, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-light);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.navbar-brand:hover {
  color: var(--primary);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar-link {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.938rem;
  font-weight: 500;
  color: var(--text-muted);
  transition: all var(--transition);
}

.navbar-link:hover {
  color: var(--text);
  background: rgba(5, 150, 105, 0.06);
}

.navbar-link.active {
  color: var(--primary);
  background: rgba(5, 150, 105, 0.1);
}

.navbar-admin-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.navbar-cta {
  margin-left: 8px;
  padding: 8px 20px;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  background: rgba(5, 150, 105, 0.08);
  transition: background var(--transition);
  color: var(--text);
  text-decoration: none;
}

.navbar-user:hover {
  background: rgba(5, 150, 105, 0.15);
  color: var(--text);
}

.navbar-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--primary-light);
}

.navbar-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: white;
  font-size: 0.85rem;
  font-weight: 700;
}

.navbar-username {
  font-size: 0.875rem;
  font-weight: 500;
}

.navbar-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  transition: background var(--transition);
}

.navbar-toggle:hover {
  background: rgba(5, 150, 105, 0.06);
}

@media (max-width: 768px) {
  .navbar-toggle {
    display: flex;
  }

  .navbar-links {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    padding: 16px;
    background: rgba(236, 253, 245, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-light);
    gap: 4px;
  }

  .navbar-links.open {
    display: flex;
  }

  .navbar-link {
    width: 100%;
    text-align: center;
    padding: 12px 16px;
  }

  .navbar-cta {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
    justify-content: center;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.jsx src/components/Navbar.css
git commit -m "feat: add role-based menu visibility and admin link to Navbar"
```

---

## Task 15: Frontend — Admin Page

**Files:**
- Create: `src/pages/Admin.jsx`
- Create: `src/pages/Admin.css`

- [ ] **Step 1: Create Admin.css**

Create `src/pages/Admin.css`:

```css
.admin-header {
  margin-bottom: 2rem;
}

.admin-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.25rem;
}

.admin-header p {
  color: var(--text-muted);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--card-shadow);
}

.users-table th,
.users-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.users-table th {
  background: rgba(5, 150, 105, 0.05);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-light);
}

.users-table td {
  font-size: 0.938rem;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-cell-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-light);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.813rem;
  font-weight: 600;
}

.role-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-white);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
}

.role-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-badge.admin {
  background: rgba(220, 38, 38, 0.1);
  color: #DC2626;
}

.role-badge.moderator {
  background: rgba(217, 119, 6, 0.1);
  color: #D97706;
}

.role-badge.member {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}

.admin-notice {
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 12px 16px;
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.2);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-size: 0.875rem;
}

.admin-error {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .users-table {
    display: block;
    overflow-x: auto;
  }
}
```

- [ ] **Step 2: Create Admin.jsx**

Create `src/pages/Admin.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import { edgeFunctions } from '../services/edgeFunctions'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

const ROLE_LABELS = {
  admin: '管理員',
  moderator: '版主',
  member: '成員',
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const data = await edgeFunctions.getUsers()
      setUsers(data ?? [])
    } catch (err) {
      setError(err.message ?? '無法載入使用者列表')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole)

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )

      setNotice('角色已更新。該用戶需要重新登入才會生效。')
    } catch (err) {
      setNotice(err.message ?? '角色更新失敗')
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card admin-error">
              <p>{error}</p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="admin-header">
            <h2><Shield size={24} /> 管理後台</h2>
            <p>管理社群成員角色與權限</p>
          </div>

          {notice && <div className="admin-notice">{notice}</div>}

          <table className="users-table">
            <thead>
              <tr>
                <th>使用者</th>
                <th>Email</th>
                <th>目前角色</th>
                <th>變更角色</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="user-cell-avatar" />
                      ) : (
                        <div className="user-cell-avatar-placeholder">
                          {(u.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{u.display_name}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    {u.id === currentUser?.id ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>（自己）</span>
                    ) : (
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="member">成員</option>
                        <option value="moderator">版主</option>
                        <option value="admin">管理員</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Admin.jsx src/pages/Admin.css
git commit -m "feat: add Admin page with user role management"
```

---

## Task 16: Deploy Edge Functions & Final Verification

- [ ] **Step 1: Install Supabase CLI (if not installed)**

```bash
npm install -g supabase
```

- [ ] **Step 2: Login to Supabase CLI**

```bash
supabase login
```

- [ ] **Step 3: Link project**

```bash
cd d:/suslab_web
supabase link --project-ref <your-project-ref>
```

Replace `<your-project-ref>` with your Supabase project reference ID (found in Supabase Dashboard > Settings > General).

- [ ] **Step 4: Deploy all Edge Functions**

```bash
supabase functions deploy get-events
supabase functions deploy manage-events
supabase functions deploy get-profile
supabase functions deploy manage-users
```

- [ ] **Step 5: Set your first user as admin**

In Supabase SQL Editor:

```sql
-- Replace with your actual user_id (find it in Authentication > Users)
update public.user_roles
set role = 'admin'
where user_id = '<your-user-id>';
```

- [ ] **Step 6: Verify end-to-end**

1. Sign out and sign back in (to refresh JWT with admin role)
2. Verify Navbar shows "管理後台" link
3. Visit `/admin` — should see user list
4. Visit `/dashboard` — should load events via Edge Function
5. Visit `/profile` — should show "管理員" role
6. Open an incognito window — only home page accessible, other pages redirect

- [ ] **Step 7: Final commit and push**

```bash
git add -A
git commit -m "feat: complete dual authentication security implementation"
git push
```
