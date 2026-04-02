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

async function resolveGuildId(
  client: ReturnType<typeof createClient>,
  requestedGuildId?: string,
): Promise<string | null> {
  if (requestedGuildId) return requestedGuildId

  const { data, error } = await client
    .from('discord_guilds')
    .select('guild_id')
    .eq('bot_enabled', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.guild_id ?? null
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
    guild_id: (payload.guild_id as string | undefined) ?? null,
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
      const guildId = await resolveGuildId(sc, body.guild_id)
      let query = supabaseClient
        .from('discord_roles')
        .select('*')
        .order('position', { ascending: true })

      if (guildId) {
        query = query.eq('guild_id', guildId)
      }

      const { data, error } = await query

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'create') {
      if (role !== 'admin') return errorResponse('Only admin can create roles', 403)

      const { name, color, permissions, position } = body
      const guildId = await resolveGuildId(sc, body.guild_id)
      if (!name) return errorResponse('Missing role name', 400)
      if (!guildId) return errorResponse('No Discord guild configured for role management', 400)

      const { data, error } = await supabaseClient
        .from('discord_roles')
        .insert({
          guild_id: guildId,
          name,
          color: color ?? '#99AAB5',
          permissions: permissions ?? {},
          position: position ?? 0,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_create', 'role', data.id, name, { color, guild_id: guildId })
      await queueBotAction(sc, 'create_role', {
        guild_id: guildId,
        role_id: data.id,
        name,
        color,
        permissions,
        position,
      }, user.id)

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
      if (data.discord_role_id && data.guild_id) {
        await queueBotAction(sc, 'update_role', {
          guild_id: data.guild_id,
          role_id: data.id,
          discord_role_id: data.discord_role_id,
          ...updates,
        }, user.id)
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
        .select('name, discord_role_id, guild_id')
        .eq('id', id)
        .single()

      const { error } = await supabaseClient
        .from('discord_roles')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_delete', 'role', id, existing?.name ?? 'Unknown', {})
      if (existing?.discord_role_id && existing?.guild_id) {
        await queueBotAction(sc, 'delete_role', {
          guild_id: existing.guild_id,
          role_id: id,
          discord_role_id: existing.discord_role_id,
        }, user.id)
      }

      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
