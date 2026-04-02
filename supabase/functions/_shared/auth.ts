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

export interface ServerAuthResult extends AuthResult {
  serverId: string
  serverRole: string
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
    throw { message: `Insufficient permissions. Required: ${minimumRole}, current: ${role}`, status: 403 }
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

/**
 * verifyAuthWithServer — JWT 驗證 + 伺服器成員身份與角色確認
 * 除了基本 JWT 驗證外，還會確認使用者在指定 server 中的成員資格，
 * 並解析其 server 層級的角色（明確指定 > role_mapping > 預設 member）。
 */
export async function verifyAuthWithServer(
  req: Request,
  minimumRole: string,
  serverId: string,
): Promise<ServerAuthResult> {
  // 1. 基本 JWT 驗證（使用現有 verifyAuth，全域最低角色為 member）
  const baseAuth = await verifyAuth(req, 'member')
  const { user, role, supabaseClient } = baseAuth

  // 使用 service role client 查詢 server 相關資料（繞過 RLS）
  const sc = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 2. 確認使用者是該 server 的成員
  const { data: membership, error: memberError } = await sc
    .from('server_members')
    .select('discord_roles')
    .eq('server_id', serverId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !membership) {
    throw { message: 'User is not a member of this server', status: 403 }
  }

  // 3. 查詢 user_roles 中該 server 的明確角色
  const { data: userRoleRow } = await sc
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('server_id', serverId)
    .maybeSingle()

  let serverRole: string
  let _roleSource: 'explicit' | 'mapping' | 'default'

  if (userRoleRow?.role) {
    // 明確指定的角色
    serverRole = userRoleRow.role
    _roleSource = 'explicit'
  } else {
    // 嘗試從 servers.settings.role_mapping 推導角色
    const { data: serverRow } = await sc
      .from('servers')
      .select('settings')
      .eq('id', serverId)
      .single()

    const roleMapping: Record<string, string> = (serverRow?.settings?.role_mapping ?? {}) as Record<string, string>
    const discordRoles: string[] = (membership.discord_roles ?? []) as string[]

    // 找出 discord_roles 中優先順序最高的角色（admin > moderator > member）
    const mappedRoles = discordRoles
      .map((dr: string) => roleMapping[dr])
      .filter(Boolean)

    const bestMapped = ['admin', 'moderator', 'member'].find((r) => mappedRoles.includes(r))

    if (bestMapped) {
      serverRole = bestMapped
      _roleSource = 'mapping'
    } else {
      serverRole = 'member'
      _roleSource = 'default'
    }
  }

  // 4. 確認 server 層級角色符合最低要求
  const serverLevel = ROLE_LEVELS[serverRole] ?? 0
  const requiredLevel = ROLE_LEVELS[minimumRole] ?? 0

  if (serverLevel < requiredLevel) {
    throw {
      message: `Insufficient server permissions. Required: ${minimumRole}, current: ${serverRole}`,
      status: 403,
    }
  }

  return { user, role, supabaseClient, serverId, serverRole }
}
