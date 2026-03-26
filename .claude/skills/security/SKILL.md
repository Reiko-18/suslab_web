---
name: security
description: OWASP security checklist for SusLab Web — auth, input validation, Edge Functions, RLS
autoActivate: true
---

# Security — SusLab Web

## OWASP Top 10 Checklist

### Broken Access Control
- [ ] All Edge Functions verify JWT via `_shared/auth.ts`
- [ ] Role checks (`hasRole`) before admin/moderator operations
- [ ] RLS policies active on ALL tables as second defense layer
- [ ] No direct table access from client — always via Edge Functions

### Injection
- [ ] Supabase client uses parameterized queries (never string concat)
- [ ] User input sanitized before database operations
- [ ] No `eval()` or `dangerouslySetInnerHTML` without sanitization

### Authentication Failures
- [ ] Discord OAuth tokens never stored in localStorage (Supabase handles session)
- [ ] Session expiry handled in `AuthContext.onAuthStateChange`
- [ ] No JWT secrets exposed in client code

### Security Misconfiguration
- [ ] `.env` is gitignored — NEVER commit secrets
- [ ] `VITE_` prefix only on non-sensitive env vars
- [ ] `service_role` key ONLY in Edge Functions (server-side)
- [ ] CORS headers restrict to known origins

### Sensitive Data Exposure
- [ ] Profile visibility settings respected in `get-members`
- [ ] User email/Discord tokens never leaked to other users
- [ ] Audit logs capture all admin actions

## Edge Function Security Pattern
```typescript
// Every Edge Function MUST start with:
import { verifyAuth } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const { user, role, error } = await verifyAuth(req)
if (error) return new Response(JSON.stringify({ error }), { status: 401, headers: corsHeaders })
```

## Report Format
When reporting issues use: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`
