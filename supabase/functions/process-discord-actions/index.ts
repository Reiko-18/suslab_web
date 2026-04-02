import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import {
  addDiscordMemberRole,
  banDiscordMember,
  createDiscordRole,
  deleteDiscordRole,
  getDiscordGuildMember,
  kickDiscordMember,
  removeDiscordMemberRole,
  timeoutDiscordMember,
  unbanDiscordMember,
  updateDiscordRole,
} from '../_shared/discord.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

interface PendingAction {
  id: string
  action_type: string
  guild_id: string | null
  discord_user_id: string | null
  payload: Record<string, unknown>
}

function hexColorToDiscordInt(hex?: string): number | undefined {
  if (!hex) return undefined
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined
  return Number.parseInt(normalized, 16)
}

async function markActionStatus(
  client: ReturnType<typeof createClient>,
  actionId: string,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string,
) {
  const updates: Record<string, unknown> = {
    status,
    processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    error_message: errorMessage ?? null,
  }

  const { error } = await client
    .from('pending_bot_actions')
    .update(updates)
    .eq('id', actionId)

  if (error) throw error
}

async function findBoundRoleId(
  client: ReturnType<typeof createClient>,
  guildId: string,
  newRole: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('discord_roles')
    .select('discord_role_id, name')
    .eq('guild_id', guildId)

  if (error) throw error

  const target = (data ?? []).find((role: { discord_role_id?: string | null; name: string }) =>
    role.discord_role_id && role.name.toLowerCase() === newRole.toLowerCase(),
  )

  return target?.discord_role_id ?? null
}

async function syncManagedRole(
  client: ReturnType<typeof createClient>,
  guildId: string,
  discordUserId: string,
  newRole: string,
) {
  const { data: roles, error } = await client
    .from('discord_roles')
    .select('discord_role_id, name')
    .eq('guild_id', guildId)
    .not('discord_role_id', 'is', null)

  if (error) throw error

  const manageableRoles = (roles ?? []).filter((role: { name: string }) =>
    ['member', 'moderator', 'admin'].includes(role.name.toLowerCase()),
  )

  const targetRoleId = await findBoundRoleId(client, guildId, newRole)
  if (!targetRoleId) {
    throw new Error(`No Discord role bound to app role "${newRole}" in guild ${guildId}`)
  }

  const member = await getDiscordGuildMember(guildId, discordUserId)
  const currentRoleIds = new Set(member.roles ?? [])

  for (const role of manageableRoles) {
    if (!role.discord_role_id) continue
    if (role.discord_role_id !== targetRoleId && currentRoleIds.has(role.discord_role_id)) {
      await removeDiscordMemberRole(guildId, discordUserId, role.discord_role_id)
    }
  }

  if (!currentRoleIds.has(targetRoleId)) {
    await addDiscordMemberRole(guildId, discordUserId, targetRoleId)
  }
}

async function processAction(client: ReturnType<typeof createClient>, action: PendingAction) {
  const guildId = action.guild_id ?? (action.payload.guild_id as string | undefined) ?? null

  switch (action.action_type) {
    case 'create_role': {
      if (!guildId) throw new Error('Missing guild_id for create_role')
      const createdRole = await createDiscordRole(guildId, {
        name: action.payload.name,
        color: hexColorToDiscordInt(action.payload.color as string | undefined),
        permissions: action.payload.permissions,
      })

      const localRoleId = action.payload.role_id as string | undefined
      if (localRoleId) {
        const { error } = await client
          .from('discord_roles')
          .update({
            discord_role_id: (createdRole as { id: string }).id,
            is_synced: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', localRoleId)

        if (error) throw error
      }
      break
    }

    case 'update_role': {
      if (!guildId) throw new Error('Missing guild_id for update_role')
      const discordRoleId = action.payload.discord_role_id as string | undefined
      if (!discordRoleId) throw new Error('Missing discord_role_id for update_role')
      await updateDiscordRole(guildId, discordRoleId, {
        name: action.payload.name,
        color: hexColorToDiscordInt(action.payload.color as string | undefined),
        permissions: action.payload.permissions,
      })
      break
    }

    case 'delete_role': {
      if (!guildId) throw new Error('Missing guild_id for delete_role')
      const discordRoleId = action.payload.discord_role_id as string | undefined
      if (!discordRoleId) throw new Error('Missing discord_role_id for delete_role')
      await deleteDiscordRole(guildId, discordRoleId)
      break
    }

    case 'sync_role': {
      if (!guildId) throw new Error('Missing guild_id for sync_role')
      const discordUserId = action.discord_user_id ?? (action.payload.discord_user_id as string | undefined)
      const newRole = action.payload.new_role as string | undefined
      if (!discordUserId || !newRole) throw new Error('Missing discord user or role binding')
      await syncManagedRole(client, guildId, discordUserId, newRole)
      break
    }

    case 'ban_user': {
      if (!guildId) throw new Error('Missing guild_id for ban_user')
      const discordUserId = action.discord_user_id ?? (action.payload.discord_user_id as string | undefined)
      if (!discordUserId) throw new Error('Missing discord_user_id for ban_user')
      await banDiscordMember(guildId, discordUserId, action.payload.reason as string | undefined)
      break
    }

    case 'unban_user': {
      if (!guildId) throw new Error('Missing guild_id for unban_user')
      const discordUserId = action.discord_user_id ?? (action.payload.discord_user_id as string | undefined)
      if (!discordUserId) throw new Error('Missing discord_user_id for unban_user')
      await unbanDiscordMember(guildId, discordUserId)
      break
    }

    case 'kick_user': {
      if (!guildId) throw new Error('Missing guild_id for kick_user')
      const discordUserId = action.discord_user_id ?? (action.payload.discord_user_id as string | undefined)
      if (!discordUserId) throw new Error('Missing discord_user_id for kick_user')
      await kickDiscordMember(guildId, discordUserId)
      break
    }

    case 'timeout_user': {
      if (!guildId) throw new Error('Missing guild_id for timeout_user')
      const discordUserId = action.discord_user_id ?? (action.payload.discord_user_id as string | undefined)
      const timeoutUntil = action.payload.timeout_until as string | undefined
      if (!discordUserId || !timeoutUntil) throw new Error('Missing timeout target or expiry')
      await timeoutDiscordMember(guildId, discordUserId, timeoutUntil)
      break
    }

    default:
      throw new Error(`Unsupported action type: ${action.action_type}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await verifyAuth(req, 'admin')
    const body = await req.json().catch(() => ({}))
    const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 100)
    const guildId = typeof body.guild_id === 'string' ? body.guild_id : null
    const client = serviceClient()

    let query = client
      .from('pending_bot_actions')
      .select('id, action_type, guild_id, discord_user_id, payload')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (guildId) {
      query = query.eq('guild_id', guildId)
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 500)

    const results = []
    for (const action of (data ?? []) as PendingAction[]) {
      try {
        await markActionStatus(client, action.id, 'processing')
        await processAction(client, action)
        await markActionStatus(client, action.id, 'completed')
        results.push({ id: action.id, status: 'completed' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Discord sync error'
        await markActionStatus(client, action.id, 'failed', message)
        results.push({ id: action.id, status: 'failed', error: message })
      }
    }

    return jsonResponse({
      processed: results.length,
      results,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
