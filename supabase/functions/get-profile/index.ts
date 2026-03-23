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
