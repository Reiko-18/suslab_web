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

async function resolveDiscordUserId(
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('member_profiles')
    .select('discord_user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.discord_user_id ?? null
}

async function resolveTargetGuildIds(
  client: ReturnType<typeof createClient>,
  userId: string,
  requestedGuildId?: string,
): Promise<string[]> {
  if (requestedGuildId) return [requestedGuildId]

  const { data, error } = await client
    .from('discord_guild_memberships')
    .select('guild_id')
    .eq('user_id', userId)

  if (error) throw error

  const guildIds = (data ?? []).map((row: { guild_id: string }) => row.guild_id)
  if (guildIds.length) return guildIds

  const { data: fallback, error: fallbackError } = await client
    .from('discord_guilds')
    .select('guild_id')
    .eq('bot_enabled', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallbackError) throw fallbackError
  return fallback?.guild_id ? [fallback.guild_id] : []
}

async function queueGuildActions(
  client: ReturnType<typeof createClient>,
  actionType: string,
  guildIds: string[],
  payloadFactory: (guildId: string) => Record<string, unknown>,
  createdBy: string,
  discordUserId: string | null,
) {
  if (!guildIds.length) return

  const rows = guildIds.map((guildId) => ({
    action_type: actionType,
    guild_id: guildId,
    discord_user_id: discordUserId,
    payload: payloadFactory(guildId),
    created_by: createdBy,
  }))

  const { error } = await client.from('pending_bot_actions').insert(rows)
  if (error) throw error
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

      const { data: roles, error: rolesError } = await sc
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
        discord_user_id: (u.user_metadata?.provider_id as string) ?? null,
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
      const guildIds = await resolveTargetGuildIds(sc, user_id, body.guild_id)
      const discordUserId = await resolveDiscordUserId(sc, user_id)

      const { data, error } = await sc
        .from('user_roles')
        .upsert({ user_id, role: newRole }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Sync role into auth.users raw_app_meta_data so JWT includes it
      await sc.auth.admin.updateUserById(user_id, {
        app_metadata: { role: newRole },
      })

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
      await queueGuildActions(
        sc,
        'sync_role',
        guildIds,
        (guildId) => ({ guild_id: guildId, user_id, discord_user_id: discordUserId, new_role: newRole }),
        user.id,
        discordUserId,
      )

      return jsonResponse({ ...data, notice: 'Role updated. User must re-login.' })
    }

    if (action === 'ban') {
      const { user_id, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (user_id === user.id) return errorResponse('Cannot ban yourself', 400)
      const guildIds = await resolveTargetGuildIds(sc, user_id, body.guild_id)
      const discordUserId = await resolveDiscordUserId(sc, user_id)

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

      await queueGuildActions(
        sc,
        'ban_user',
        guildIds,
        (guildId) => ({ guild_id: guildId, user_id, discord_user_id: discordUserId, reason }),
        user.id,
        discordUserId,
      )

      return jsonResponse({ success: true, action: 'banned' })
    }

    if (action === 'unban') {
      const { user_id } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      const guildIds = await resolveTargetGuildIds(sc, user_id, body.guild_id)
      const discordUserId = await resolveDiscordUserId(sc, user_id)

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

      await queueGuildActions(
        sc,
        'unban_user',
        guildIds,
        (guildId) => ({ guild_id: guildId, user_id, discord_user_id: discordUserId }),
        user.id,
        discordUserId,
      )

      return jsonResponse({ success: true, action: 'unbanned' })
    }

    if (action === 'kick') {
      const { user_id, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (user_id === user.id) return errorResponse('Cannot kick yourself', 400)
      const guildIds = await resolveTargetGuildIds(sc, user_id, body.guild_id)
      const discordUserId = await resolveDiscordUserId(sc, user_id)

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

      await queueGuildActions(
        sc,
        'kick_user',
        guildIds,
        (guildId) => ({ guild_id: guildId, user_id, discord_user_id: discordUserId, reason }),
        user.id,
        discordUserId,
      )

      return jsonResponse({ success: true, action: 'kick_queued' })
    }

    if (action === 'timeout') {
      const { user_id, duration_minutes, reason } = body
      if (!user_id) return errorResponse('Missing user_id', 400)
      if (!duration_minutes) return errorResponse('Missing duration_minutes', 400)
      if (user_id === user.id) return errorResponse('Cannot timeout yourself', 400)
      const guildIds = await resolveTargetGuildIds(sc, user_id, body.guild_id)
      const discordUserId = await resolveDiscordUserId(sc, user_id)

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

      await queueGuildActions(
        sc,
        'timeout_user',
        guildIds,
        (guildId) => ({
          guild_id: guildId,
          user_id,
          discord_user_id: discordUserId,
          duration_minutes,
          reason,
          timeout_until: timeoutUntil,
        }),
        user.id,
        discordUserId,
      )

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
