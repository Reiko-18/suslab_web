import { Client, Guild, GuildMember } from 'discord.js'
import { supabase } from './supabase.js'

/**
 * 同步 Discord 伺服器到 Supabase servers 資料表
 * @returns 伺服器的 Supabase UUID
 */
export async function syncGuild(guild: Guild): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('servers')
      .upsert(
        {
          discord_guild_id: guild.id,
          name: guild.name,
          icon_url: guild.iconURL() ?? null,
          owner_id: guild.ownerId,
          is_active: true,
        },
        { onConflict: 'discord_guild_id' },
      )
      .select('id')
      .single()

    if (error) throw error
    if (!data) throw new Error(`syncGuild: no data returned for guild ${guild.id}`)

    console.log(`[guildSync] 同步伺服器完成: ${guild.name} (${guild.id}) → ${data.id}`)
    return data.id as string
  } catch (err) {
    console.error(`[guildSync] syncGuild 失敗 (${guild.id}):`, err)
    throw err
  }
}

/**
 * 透過 Discord user ID 查找對應的 Supabase auth user ID
 * 使用者未登入 Dashboard 時回傳 null（正常情況）
 */
export async function resolveUserId(discordUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })

    if (error) throw error

    const matched = data.users.find((user) =>
      user.identities?.some(
        (identity) => identity.provider === 'discord' && identity.id === discordUserId,
      ),
    )

    return matched?.id ?? null
  } catch (err) {
    console.error(`[guildSync] resolveUserId 失敗 (discordUserId: ${discordUserId}):`, err)
    return null
  }
}

/**
 * 同步單一成員到 server_members 資料表
 * 若使用者尚未登入 Dashboard（resolveUserId 回傳 null），則跳過
 */
export async function syncMember(serverId: string, member: GuildMember): Promise<void> {
  try {
    const userId = await resolveUserId(member.user.id)

    if (!userId) {
      // 使用者尚未透過 Discord OAuth 登入 Dashboard，屬正常情況
      return
    }

    // 排除 @everyone 角色，只保留實際 Discord 身份組名稱
    const discordRoles = member.roles.cache
      .filter((role) => role.name !== '@everyone')
      .map((role) => role.name)

    const { error } = await supabase.from('server_members').upsert(
      {
        server_id: serverId,
        user_id: userId,
        discord_roles: discordRoles,
        joined_at: member.joinedAt?.toISOString() ?? new Date().toISOString(),
      },
      { onConflict: 'server_id,user_id' },
    )

    if (error) throw error

    console.log(`[guildSync] 同步成員: ${member.user.tag} → server_members`)
  } catch (err) {
    console.error(`[guildSync] syncMember 失敗 (${member.user.id}):`, err)
  }
}

/**
 * 從 server_members 移除指定成員
 */
export async function removeMember(serverId: string, discordUserId: string): Promise<void> {
  try {
    const userId = await resolveUserId(discordUserId)

    if (!userId) {
      // 使用者不在資料庫中，無需移除
      return
    }

    const { error } = await supabase
      .from('server_members')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId)

    if (error) throw error

    console.log(`[guildSync] 移除成員: discordUserId=${discordUserId} from server=${serverId}`)
  } catch (err) {
    console.error(`[guildSync] removeMember 失敗 (${discordUserId}):`, err)
  }
}

/**
 * 同步伺服器的所有成員（跳過機器人帳號）
 * @returns 成功同步的成員數量
 */
export async function syncAllMembers(serverId: string, guild: Guild): Promise<number> {
  try {
    const members = await guild.members.fetch()
    const humanMembers = members.filter((m) => !m.user.bot)

    let count = 0
    for (const [, member] of humanMembers) {
      await syncMember(serverId, member)
      count++
    }

    console.log(`[guildSync] 伺服器 ${guild.name} 成員同步完成: ${count} 位成員已處理`)
    return count
  } catch (err) {
    console.error(`[guildSync] syncAllMembers 失敗 (guild: ${guild.id}):`, err)
    return 0
  }
}

/**
 * 完整同步：遍歷所有 bot 所在的伺服器，同步伺服器資料與成員
 */
export async function fullSync(client: Client): Promise<void> {
  console.log(`[guildSync] 開始全量同步，共 ${client.guilds.cache.size} 個伺服器...`)

  for (const [, guild] of client.guilds.cache) {
    try {
      const serverId = await syncGuild(guild)
      const count = await syncAllMembers(serverId, guild)
      console.log(`[guildSync] 伺服器 "${guild.name}" 同步完成，處理 ${count} 位成員`)
    } catch (err) {
      console.error(`[guildSync] 全量同步中，伺服器 ${guild.id} 發生錯誤:`, err)
    }
  }

  console.log('[guildSync] 全量同步完成')
}
