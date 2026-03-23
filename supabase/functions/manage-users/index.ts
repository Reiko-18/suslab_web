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
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers()
      if (usersError) return errorResponse(usersError.message, 500)

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
