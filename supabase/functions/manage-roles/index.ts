// supabase/functions/manage-roles/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyAuthWithServer, errorResponse, jsonResponse } from '../_shared/auth.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
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
  serverId?: string | null,
) {
  await client.from('admin_audit_logs').insert({
    actor_id: actorId,
    actor_name: actorName,
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    details,
    server_id: serverId ?? null,
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
    payload,
    created_by: createdBy,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, server_id } = body
    const sc = serviceClient()

    let user: Awaited<ReturnType<typeof verifyAuth>>['user']
    let role: string
    let supabaseClient: Awaited<ReturnType<typeof verifyAuth>>['supabaseClient']

    if (server_id) {
      const auth = await verifyAuthWithServer(req, 'moderator', server_id)
      user = auth.user; role = auth.serverRole; supabaseClient = auth.supabaseClient
    } else {
      const auth = await verifyAuth(req, 'moderator')
      user = auth.user; role = auth.role; supabaseClient = auth.supabaseClient
    }

    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    if (action === 'list') {
      let query = supabaseClient
        .from('discord_roles')
        .select('*')
        .order('position', { ascending: true })

      if (server_id) {
        query = query.eq('server_id', server_id)
      }

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'create') {
      if (role !== 'admin') return errorResponse('Only admin can create roles', 403)

      const { name, color, permissions, position } = body
      if (!name) return errorResponse('Missing role name', 400)

      const { data, error } = await supabaseClient
        .from('discord_roles')
        .insert({
          name,
          color: color ?? '#99AAB5',
          permissions: permissions ?? {},
          position: position ?? 0,
          created_by: user.id,
          server_id: server_id ?? null,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_create', 'role', data.id, name, { color }, server_id)
      await queueBotAction(sc, 'create_role', { name, color, permissions }, user.id)

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

      let updateQuery = supabaseClient
        .from('discord_roles')
        .update(updates)
        .eq('id', id)

      if (server_id) {
        updateQuery = updateQuery.eq('server_id', server_id)
      }

      const { data, error } = await updateQuery.select().single()

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_update', 'role', id, data.name, updates, server_id)
      if (data.discord_role_id) {
        await queueBotAction(sc, 'update_role', { discord_role_id: data.discord_role_id, ...updates }, user.id)
      }

      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') return errorResponse('Only admin can delete roles', 403)

      const { id } = body
      if (!id) return errorResponse('Missing role id', 400)

      // Get role before deleting for audit
      let selectQuery = supabaseClient
        .from('discord_roles')
        .select('name, discord_role_id')
        .eq('id', id)

      if (server_id) {
        selectQuery = selectQuery.eq('server_id', server_id)
      }

      const { data: existing } = await selectQuery.single()

      let deleteQuery = supabaseClient
        .from('discord_roles')
        .delete()
        .eq('id', id)

      if (server_id) {
        deleteQuery = deleteQuery.eq('server_id', server_id)
      }

      const { error } = await deleteQuery

      if (error) return errorResponse(error.message, 500)

      await logAudit(sc, user.id, actorName, 'role_delete', 'role', id, existing?.name ?? 'Unknown', {}, server_id)
      if (existing?.discord_role_id) {
        await queueBotAction(sc, 'delete_role', { discord_role_id: existing.discord_role_id }, user.id)
      }

      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
