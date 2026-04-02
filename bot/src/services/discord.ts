import { supabase } from './supabase.js'

/**
 * 透過 Discord user ID 解析對應的 Supabase auth user ID
 * 使用者未連結 Dashboard 帳號時回傳 null
 */
export async function resolveSupabaseUserId(discordUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) throw error

    const user = data.users.find((u) =>
      u.identities?.some((i) => i.provider === 'discord' && i.id === discordUserId),
    )
    return user?.id ?? null
  } catch (err) {
    console.error(`[discord] resolveSupabaseUserId 失敗 (${discordUserId}):`, err)
    return null
  }
}

/**
 * 透過 Discord guild ID 查找對應的 Supabase server UUID
 */
export async function getServerIdFromGuild(guildId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('id')
      .eq('discord_guild_id', guildId)
      .single()

    if (error) throw error
    return data?.id ?? null
  } catch (err) {
    console.error(`[discord] getServerIdFromGuild 失敗 (${guildId}):`, err)
    return null
  }
}

/**
 * 取得使用者在指定伺服器的角色，預設為 'member'
 */
export async function getUserRoleInServer(userId: string, serverId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('server_id', serverId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data?.role ?? 'member'
  } catch (err) {
    console.error(`[discord] getUserRoleInServer 失敗 (userId: ${userId}):`, err)
    return 'member'
  }
}
