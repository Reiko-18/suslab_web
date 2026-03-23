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
