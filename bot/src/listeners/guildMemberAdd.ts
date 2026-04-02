import { Client, Events, WebhookClient, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { syncMember } from '../services/guildSync.js'

/**
 * 註冊 GuildMemberAdd 事件監聽器
 * 當新成員加入伺服器時，自動同步到資料庫，並依設定發送 Webhook 通知
 */
export function registerGuildMemberAdd(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      // 跳過機器人帳號
      if (member.user.bot) return

      const guild = member.guild

      // 透過 discord_guild_id 查詢對應的 server_id
      const { data: serverData, error: serverError } = await supabase
        .from('servers')
        .select('id, settings')
        .eq('discord_guild_id', guild.id)
        .single()

      if (serverError || !serverData) {
        console.error(
          `[guildMemberAdd] 找不到伺服器記錄 (discord_guild_id: ${guild.id}):`,
          serverError,
        )
        return
      }

      const serverId = serverData.id as string
      const settings = (serverData.settings ?? {}) as Record<string, unknown>

      // 同步新成員到資料庫
      await syncMember(serverId, member)
      console.log(`[guildMemberAdd] 成員加入並同步完成: ${member.user.tag} (${guild.name})`)

      // 若伺服器設定了 notify_new_user 且有 notification_webhook_url，發送 Discord Webhook 通知
      if (settings.notify_new_user && typeof settings.notification_webhook_url === 'string') {
        try {
          const webhookClient = new WebhookClient({ url: settings.notification_webhook_url })

          const embed = new EmbedBuilder()
            .setTitle('New Member Joined')
            .setDescription(`<@${member.user.id}> 加入了 **${guild.name}**！`)
            .setColor(0x4caf50) // 綠色
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setTimestamp()
            .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })

          await webhookClient.send({ embeds: [embed] })
          console.log(`[guildMemberAdd] 已發送 Webhook 通知 (${member.user.tag})`)
        } catch (webhookErr) {
          console.error(`[guildMemberAdd] Webhook 發送失敗:`, webhookErr)
        }
      }
    } catch (err) {
      console.error(`[guildMemberAdd] 處理成員加入事件時發生錯誤:`, err)
    }
  })
}
