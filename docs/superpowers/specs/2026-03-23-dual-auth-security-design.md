# Dual Authentication Security Design

## Overview

Add frontend + backend dual authentication to SusLab web platform. Combines Supabase RLS (Row Level Security) with Supabase Edge Functions to create two independent layers of access control.

## Current State

- Frontend: Supabase Auth with Discord OAuth (implemented)
- Backend: No protection — frontend queries Supabase directly with anon key
- Roles: None
- Access control: Only Profile page checks login status client-side
- Database: `events` table exists (columns: id, title, description, date, time, location, attendees)

## Goals

- All sensitive data protected at database level (RLS)
- All data access goes through Edge Functions that verify JWT tokens
- Role-based access control: admin / moderator / member
- Only the home page is public; everything else requires authentication

---

## 1. Database Structure

### `events` table (existing)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Event title |
| `description` | text | Event description |
| `date` | date | Event date |
| `time` | text | Event time |
| `location` | text | Event location |
| `attendees` | integer | Attendee count |

This table already exists in Supabase. The migration will only add RLS policies to it.

### `user_roles` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, default gen_random_uuid()) | Auto-generated |
| `user_id` | uuid (FK → auth.users.id, UNIQUE) | User ID |
| `role` | text CHECK (role IN ('admin', 'moderator', 'member')) | User role |
| `created_at` | timestamptz (default now()) | Created timestamp |
| `updated_at` | timestamptz (default now()) | Updated timestamp |

### Auto-assign trigger

A PostgreSQL trigger on `auth.users` INSERT that automatically creates a `user_roles` row with `role = 'member'` for every new user.

### Auto-update `updated_at` trigger

A PostgreSQL trigger on `user_roles` UPDATE that automatically sets `updated_at = now()`.

### Custom Access Token Hook

A PostgreSQL function `custom_access_token_hook` that injects the user's role into the JWT `app_metadata`.

If the `user_roles` row does not exist (race condition where trigger hasn't fired yet), the hook defaults to `'member'` role to prevent JWT without a role:

```sql
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Default to 'member' if role not found (race condition safety)
  IF user_role IS NULL THEN
    user_role := 'member';
  END IF;

  event := jsonb_set(
    event,
    '{claims,app_metadata}',
    coalesce(event->'claims'->'app_metadata', '{}'::jsonb) || jsonb_build_object('role', user_role)
  );

  RETURN event;
END;
$$;
```

This hook is registered in Supabase Dashboard under Authentication > Hooks > Customize Access Token.

After this, all JWTs contain: `{ app_metadata: { role: "member" } }`.

---

## 2. RLS Policies

### Role extraction helper

All RLS policies read the role from:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role')
```

### Permission matrix (general guideline)

This is a general guideline. Individual table policies may be more permissive where appropriate (e.g., `events` SELECT is open to all authenticated users, not just "own data").

| Operation | member | moderator | admin |
|-----------|--------|-----------|-------|
| SELECT | Own data + shared data | All data | All data |
| INSERT | Own data only | Own data only | All |
| UPDATE | Own data only | Own + managed scope | All |
| DELETE | Not allowed | Managed scope | All |

### `events` table policies

- **SELECT**: Any authenticated user (`auth.uid() IS NOT NULL`)
- **INSERT / UPDATE**: role IN ('moderator', 'admin')
- **DELETE**: role = 'admin'

### `user_roles` table self-protection

- **SELECT**: User can only read own role (`user_id = auth.uid()`), or admin can read all
- **INSERT**: No INSERT policy (deny by default with RLS enabled). Only the auto-assign trigger (which runs as function owner with SECURITY DEFINER) can insert rows.
- **UPDATE**: Only admin (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`)
- **DELETE**: Only admin

### All future tables

Every new table must have RLS enabled with policies following the permission matrix above. No table should ever be created without RLS.

---

## 3. Edge Functions Verification Layer

### Architecture

```
Frontend Request
  → Edge Function
    → Verify JWT (supabase.auth.getUser)
    → Check role from app_metadata
    → Access DB with user's JWT (RLS active)
    → Return data
```

### Security model clarification

Edge Functions create a Supabase client using the **user's JWT** (not `service_role` key) for database queries. This means **RLS is actively enforced on every query**, providing true dual protection:

- **Layer 1 (Edge Function):** Validates token, checks role before allowing the request
- **Layer 2 (RLS):** Enforces row-level access even within the Edge Function's queries

The `service_role` key is NOT used for data queries. It is only used for `supabase.auth.getUser(token)` to verify token validity server-side.

### CORS Configuration

Every Edge Function must handle CORS for cross-origin requests from the Render-hosted frontend:

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders })
}
```

In production, `Access-Control-Allow-Origin` should be restricted to the actual frontend domain (`https://suslab-web.onrender.com`).

### Edge Functions

| Function | Purpose | Minimum Role | Methods |
|----------|---------|-------------|---------|
| `get-events` | Fetch events list | member | GET |
| `manage-events` | Create/update/delete events | moderator | POST, PUT, DELETE |
| `get-profile` | Fetch own profile data | member (self only) | GET |
| `manage-users` | View/modify user roles | admin | GET, PUT |

### Shared auth middleware

Extract common JWT verification and role checking into `supabase/functions/_shared/auth.ts` to avoid duplicating logic across functions:

```ts
// Returns { user, role } or throws with appropriate HTTP status
export async function verifyAuth(req: Request, minimumRole: string)
```

### Verification logic (every function, via shared middleware)

1. Return CORS headers for `OPTIONS` preflight requests
2. Extract JWT from `Authorization: Bearer <token>` header
3. Call `supabase.auth.getUser(token)` to verify token validity (server-side verification, not just decoding)
4. Read role from `user.app_metadata.role`
5. If role is `undefined`, treat as `member` (matching the hook's default behavior)
6. Check role meets minimum requirement using hierarchy: admin (3) > moderator (2) > member (1)
7. If unauthorized: return 401 (no token) or 403 (insufficient role)
8. If authorized: create Supabase client with user's JWT, query database (RLS active)
9. Return data with CORS headers

### Dual protection guarantee

Both layers are active during normal operation. If an attacker bypasses Edge Functions and queries Supabase directly with the anon key, RLS policies block unauthorized access. If RLS has a bug, Edge Functions still validate the role before executing the query. The two layers are truly independent.

---

## 4. Frontend Changes

### ProtectedRoute component

New component `src/components/ProtectedRoute.jsx`:

- Wraps routes that require authentication
- Accepts `minimumRole` prop
- Not logged in → redirect to home page
- Logged in but insufficient role → show "permission denied" message

### Route permissions

| Route | Minimum Role | Description |
|-------|-------------|-------------|
| `/` | Public | Home page |
| `/auth/callback` | Public | OAuth callback |
| `/dashboard` | member | Events list |
| `/profile` | member (self) | User profile |
| `/admin` | admin | Admin panel (new page) |

### AuthContext changes

Add to existing AuthContext:

- `role` state — extracted from `user.app_metadata.role`, defaults to `'member'` if undefined
- `hasRole(minimumRole)` — utility function comparing role hierarchy using numeric mapping: member=1, moderator=2, admin=3. Returns `userRoleLevel >= minimumRoleLevel`.

### Edge Functions client

New file `src/services/edgeFunctions.js`:

- Uses `supabase.functions.invoke()` method (automatically handles Supabase function URL and auth headers)
- No additional env variables needed — the existing `VITE_SUPABASE_URL` is sufficient
- Unified error handling:
  - 401 → redirect to login
  - 403 → show "permission denied"
- Replaces all direct Supabase database queries in the frontend

### Navbar updates

- Show/hide menu items based on role
- Admin panel link visible only to admin role

### Dashboard page update

- Replace `supabase.from('events').select('*')` with Edge Function call via `supabase.functions.invoke('get-events')`
- Remove fallback placeholder data (Edge Function handles errors)

### Profile page update

- Replace direct user metadata reading with Edge Function call for sensitive data
- Keep basic display name/avatar from auth session for UI responsiveness

### Admin page (new)

- User management: list all users with their roles
- Role modification: change user roles (admin only)
- After changing a role, display a notice that the affected user needs to re-authenticate for the new role to take effect

---

## 5. Files to Create/Modify

### New files

- `supabase/migrations/001_user_roles.sql` — user_roles table, triggers (auto-assign + updated_at), custom claims hook
- `supabase/migrations/002_rls_policies.sql` — RLS policies for events and user_roles tables
- `supabase/functions/_shared/auth.ts` — Shared JWT verification and role checking middleware
- `supabase/functions/get-events/index.ts` — Edge Function
- `supabase/functions/manage-events/index.ts` — Edge Function
- `supabase/functions/get-profile/index.ts` — Edge Function
- `supabase/functions/manage-users/index.ts` — Edge Function
- `src/components/ProtectedRoute.jsx` — Route guard component
- `src/services/edgeFunctions.js` — Edge Functions client (uses supabase.functions.invoke)
- `src/pages/Admin.jsx` — Admin panel: user list + role management
- `src/pages/Admin.css` — Admin panel styles

### Modified files

- `src/context/AuthContext.jsx` — Add role state, hasRole() with numeric hierarchy
- `src/App.jsx` — Wrap routes with ProtectedRoute
- `src/components/Navbar.jsx` — Role-based menu visibility
- `src/components/Navbar.css` — Admin link styles if needed
- `src/pages/Dashboard.jsx` — Use Edge Functions instead of direct queries
- `src/pages/Profile.jsx` — Use Edge Functions for sensitive data

---

## 6. Security Considerations

- **Never expose `service_role` key** in frontend code. Only Edge Functions use it (for `auth.getUser()` verification only, not for data queries).
- **Always verify tokens server-side** with `getUser()`, never trust client-decoded JWTs.
- **RLS is always active.** Edge Functions use the user's JWT for database queries, so RLS enforces access control on every request. This is true dual protection.
- **Role changes require token refresh.** After admin changes a user's role, the affected user must re-login or call `supabase.auth.refreshSession()` for the new role to take effect in the JWT. The admin panel should display this notice.
- **Anon key access** is restricted by RLS. The anon key alone cannot access protected data.
- **Missing role handling.** If `app_metadata.role` is undefined (edge case), both the custom claims hook and Edge Functions default to `'member'` role. The frontend AuthContext also defaults to `'member'`.
- **CORS.** Edge Functions must include CORS headers. In production, restrict `Access-Control-Allow-Origin` to the actual frontend domain.
- **Rate limiting.** Supabase Edge Functions have built-in rate limits. For additional protection, consider Supabase's built-in abuse prevention features if traffic grows.
