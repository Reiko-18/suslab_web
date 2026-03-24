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
