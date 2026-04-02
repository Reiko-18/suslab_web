import { Client, Events } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { removeMember } from '../services/guildSync.js'

/**
 * 註冊 GuildMemberRemove 事件監聽器
 * 當成員離開或被踢出伺服器時，自動從資料庫移除對應記錄
 */
export function registerGuildMemberRemove(client: Client): void {
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      // 跳過機器人帳號
      if (member.user.bot) return

      const guild = member.guild

      // 透過 discord_guild_id 查詢對應的 server_id
      const { data: serverData, error: serverError } = await supabase
        .from('servers')
        .select('id')
        .eq('discord_guild_id', guild.id)
        .single()

      if (serverError || !serverData) {
        console.error(
          `[guildMemberRemove] 找不到伺服器記錄 (discord_guild_id: ${guild.id}):`,
          serverError,
        )
        return
      }

      const serverId = serverData.id as string

      await removeMember(serverId, member.user.id)
      console.log(`[guildMemberRemove] 成員離開並移除完成: ${member.user.tag} (${guild.name})`)
    } catch (err) {
      console.error(`[guildMemberRemove] 處理成員離開事件時發生錯誤:`, err)
    }
  })
}
