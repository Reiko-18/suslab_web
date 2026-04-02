// supabase/functions/manage-servers/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

// ROLE_LEVELS 複製自 _shared/auth.ts，供 server 層級角色比對使用
const ROLE_LEVELS: Record<string, number> = {
  member: 1,
  moderator: 2,
  admin: 3,
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

// 推導使用者在某 server 的角色
// 優先順序：user_roles 明確設定 > role_mapping > 預設 member
async function resolveServerRole(
  sc: ReturnType<typeof createClient>,
  userId: string,
  serverId: string,
  discordRoles: string[],
): Promise<{ role: string; source: 'explicit' | 'mapping' | 'default' }> {
  // 查詢 user_roles 中明確設定的 server 角色
  const { data: userRoleRow } = await sc
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('server_id', serverId)
    .maybeSingle()

  if (userRoleRow?.role) {
    return { role: userRoleRow.role, source: 'explicit' }
  }

  // 從 servers.settings.role_mapping 推導角色
  const { data: serverRow } = await sc
    .from('servers')
    .select('settings')
    .eq('id', serverId)
    .single()

  const roleMapping: Record<string, string> = (serverRow?.settings?.role_mapping ?? {}) as Record<string, string>

  const mappedRoles = discordRoles
    .map((dr: string) => roleMapping[dr])
    .filter(Boolean)

  const bestMapped = ['admin', 'moderator', 'member'].find((r) => mappedRoles.includes(r))

  if (bestMapped) {
    return { role: bestMapped, source: 'mapping' }
  }

  return { role: 'member', source: 'default' }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 所有 action 最低需要 member 全域角色
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()
    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    // ─────────────────────────────────────────────────────────────
    // list — 回傳使用者所屬的所有 server（含 user_role）
    // ─────────────────────────────────────────────────────────────
    if (action === 'list') {
      // 查詢使用者的 server 成員資格
      const { data: memberships, error: memberError } = await sc
        .from('server_members')
        .select('server_id, discord_roles')
        .eq('user_id', user.id)

      if (memberError) return errorResponse(memberError.message, 500)
      if (!memberships || memberships.length === 0) return jsonResponse([])

      const serverIds = memberships.map((m: { server_id: string }) => m.server_id)

      // 查詢對應的 servers（僅 active）
      const { data: servers, error: serverError } = await sc
        .from('servers')
        .select('id, discord_guild_id, name, icon_url, is_active, settings')
        .in('id', serverIds)
        .eq('is_active', true)

      if (serverError) return errorResponse(serverError.message, 500)

      // 建立 server_id → discord_roles 的對應 map
      const membershipMap = new Map(
        (memberships as Array<{ server_id: string; discord_roles: string[] }>).map((m) => [
          m.server_id,
          m.discord_roles,
        ]),
      )

      // 為每個 server 解析使用者角色
      const result = await Promise.all(
        (servers ?? []).map(async (s: {
          id: string
          discord_guild_id: string
          name: string
          icon_url: string | null
          is_active: boolean
          settings: Record<string, unknown>
        }) => {
          const discordRoles = membershipMap.get(s.id) ?? []
          const { role: userRole } = await resolveServerRole(sc, user.id, s.id, discordRoles)
          return {
            id: s.id,
            discord_guild_id: s.discord_guild_id,
            name: s.name,
            icon_url: s.icon_url,
            is_active: s.is_active,
            user_role: userRole,
          }
        }),
      )

      return jsonResponse(result)
    }

    // ─────────────────────────────────────────────────────────────
    // get-settings — 回傳完整 server 設定（需為該 server 的 admin）
    // ─────────────────────────────────────────────────────────────
    if (action === 'get-settings') {
      const { server_id } = body
      if (!server_id) return errorResponse('Missing server_id', 400)

      // 確認成員資格並取得 discord_roles
      const { data: membership, error: memberError } = await sc
        .from('server_members')
        .select('discord_roles')
        .eq('server_id', server_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !membership) {
        return errorResponse('User is not a member of this server', 403)
      }

      // 確認 server 層級 admin 角色
      const { role: serverRole } = await resolveServerRole(
        sc,
        user.id,
        server_id,
        (membership.discord_roles ?? []) as string[],
      )

      if (ROLE_LEVELS[serverRole] < ROLE_LEVELS['admin']) {
        return errorResponse('Only server admin can view settings', 403)
      }

      const { data: server, error: serverError } = await sc
        .from('servers')
        .select('*')
        .eq('id', server_id)
        .single()

      if (serverError || !server) return errorResponse('Server not found', 404)

      return jsonResponse(server)
    }

    // ─────────────────────────────────────────────────────────────
    // update-settings — 更新 server 設定（需為該 server 的 admin）
    // ─────────────────────────────────────────────────────────────
    if (action === 'update-settings') {
      const { server_id, settings } = body
      if (!server_id) return errorResponse('Missing server_id', 400)
      if (!settings || typeof settings !== 'object') return errorResponse('Missing or invalid settings object', 400)

      // 確認成員資格並取得 discord_roles
      const { data: membership, error: memberError } = await sc
        .from('server_members')
        .select('discord_roles')
        .eq('server_id', server_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !membership) {
        return errorResponse('User is not a member of this server', 403)
      }

      // 確認 server 層級 admin 角色
      const { role: serverRole } = await resolveServerRole(
        sc,
        user.id,
        server_id,
        (membership.discord_roles ?? []) as string[],
      )

      if (ROLE_LEVELS[serverRole] < ROLE_LEVELS['admin']) {
        return errorResponse('Only server admin can update settings', 403)
      }

      // 取得現有設定以進行 merge（不替換整個 settings）
      const { data: existing, error: fetchError } = await sc
        .from('servers')
        .select('settings, name')
        .eq('id', server_id)
        .single()

      if (fetchError || !existing) return errorResponse('Server not found', 404)

      const mergedSettings = { ...(existing.settings as Record<string, unknown>), ...settings }

      const { data: updated, error: updateError } = await sc
        .from('servers')
        .update({ settings: mergedSettings, updated_at: new Date().toISOString() })
        .eq('id', server_id)
        .select()
        .single()

      if (updateError) return errorResponse(updateError.message, 500)

      // 寫入 audit log
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'server_settings_update',
        target_type: 'server',
        target_id: server_id,
        target_name: existing.name as string,
        server_id,
        details: { updated_keys: Object.keys(settings) },
      })

      return jsonResponse(updated)
    }

    // ─────────────────────────────────────────────────────────────
    // get-role — 取得使用者在指定 server 中的角色
    // ─────────────────────────────────────────────────────────────
    if (action === 'get-role') {
      const { server_id } = body
      if (!server_id) return errorResponse('Missing server_id', 400)

      // 確認成員資格並取得 discord_roles
      const { data: membership, error: memberError } = await sc
        .from('server_members')
        .select('discord_roles')
        .eq('server_id', server_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !membership) {
        return errorResponse('User is not a member of this server', 403)
      }

      const { role: serverRole, source } = await resolveServerRole(
        sc,
        user.id,
        server_id,
        (membership.discord_roles ?? []) as string[],
      )

      return jsonResponse({ role: serverRole, source })
    }

    return errorResponse('Invalid action. Use: list, get-settings, update-settings, get-role', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
