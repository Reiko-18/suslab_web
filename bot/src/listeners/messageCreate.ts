import { Client, Events, Message, EmbedBuilder, ChannelType } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

const EMBED_COLOR = 0x7c9070

/**
 * 處理 ticket 討論串中的回覆訊息
 * 將訊息插入 ticket_replies 資料表
 */
async function handleThreadReply(message: Message): Promise<void> {
  // 跳過機器人
  if (message.author.bot) return

  const threadId = message.channelId

  // 查詢是否有對應的 ticket
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, status')
    .eq('discord_thread_id', threadId)
    .single()

  if (error || !ticket) return

  // 已關閉的票券不接受新回覆
  if (ticket.status === 'closed') return

  const userId = await resolveSupabaseUserId(message.author.id)
  if (!userId) return

  const { error: insertError } = await supabase.from('ticket_replies').insert({
    ticket_id: ticket.id,
    content: message.content,
    author_id: userId,
  })

  if (insertError) {
    console.error(`[messageCreate] 插入 ticket_reply 失敗 (ticket: ${ticket.id as string}):`, insertError)
  } else {
    console.log(`[messageCreate] 討論串回覆已記錄 (ticket: ${(ticket.id as string).slice(0, 8)})`)
  }
}

/**
 * 取得伺服器設定中的 ticket_channels 清單
 */
async function fetchTicketChannels(serverId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('servers')
    .select('settings')
    .eq('id', serverId)
    .single()

  if (error || !data) return []

  const settings = (data.settings ?? {}) as Record<string, unknown>
  const channels = settings.ticket_channels
  return Array.isArray(channels) ? (channels as string[]) : []
}

/**
 * 註冊 MessageCreate 事件監聽器
 * 監控已設定的 ticket intake 頻道，自動從訊息建立票券
 */
export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // 跳過機器人
      if (message.author.bot) return

      // 跳過 DM（非伺服器訊息）
      if (!message.guild) return

      // 若訊息在討論串中，交由 handleThreadReply 處理
      if (
        message.channel.type === ChannelType.PublicThread ||
        message.channel.type === ChannelType.PrivateThread ||
        message.channel.type === ChannelType.AnnouncementThread
      ) {
        await handleThreadReply(message)
        return
      }

      // 取得對應的 Supabase server UUID
      const serverId = await getServerIdFromGuild(message.guild.id)
      if (!serverId) return

      // 確認此頻道是否為 ticket intake 頻道
      const ticketChannels = await fetchTicketChannels(serverId)
      if (!ticketChannels.includes(message.channelId)) return

      // 解析 Supabase user ID
      const userId = await resolveSupabaseUserId(message.author.id)
      if (!userId) {
        try {
          await message.reply('請先前往 SusLab Dashboard 完成帳號綁定，才能使用票券功能。')
        } catch (replyErr) {
          console.error('[messageCreate] 無法發送帳號綁定提示:', replyErr)
        }
        return
      }

      // 建立票券標題（最多 200 字元）與完整內容
      const title = message.content.slice(0, 200)
      const content = message.content

      // 插入票券記錄
      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          title,
          content,
          status: 'open',
          source: 'discord',
          created_by: userId,
          server_id: serverId,
          discord_channel_id: message.channelId,
          discord_message_id: message.id,
        })
        .select()
        .single()

      if (insertError || !ticket) {
        console.error('[messageCreate] 建立票券失敗:', insertError)
        return
      }

      const ticketId = ticket.id as string
      const shortId = ticketId.slice(0, 8)
      const threadName = `Ticket #${shortId}: ${title.slice(0, 50)}`

      // 對原始訊息加上 ✅ 反應
      try {
        await message.react('✅')
      } catch (reactErr) {
        console.error('[messageCreate] 加入反應失敗:', reactErr)
      }

      // 在原始訊息上建立討論串
      let threadId: string | null = null
      try {
        if (
          message.channel.type === ChannelType.GuildText ||
          message.channel.type === ChannelType.GuildAnnouncement
        ) {
          const thread = await message.startThread({
            name: threadName,
            autoArchiveDuration: 1440,
          })

          threadId = thread.id

          // 更新票券記錄，寫入 discord_thread_id
          const { error: updateError } = await supabase
            .from('tickets')
            .update({ discord_thread_id: threadId })
            .eq('id', ticketId)

          if (updateError) {
            console.error('[messageCreate] 更新 discord_thread_id 失敗:', updateError)
          }

          // 在討論串中發送介紹訊息
          await thread.send({
            embeds: [
              new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle(`🎫 票券 #${shortId}`)
                .setDescription(
                  `感謝 <@${message.author.id}> 的回報！\n\n**內容：** ${content}`,
                )
                .addFields(
                  { name: '狀態', value: '🟢 開放中', inline: true },
                  { name: '來源', value: 'Discord', inline: true },
                )
                .setFooter({ text: '工作人員將盡快回應，請在此討論串補充資訊' })
                .setTimestamp(),
            ],
          })

          console.log(
            `[messageCreate] 票券建立成功 #${shortId} (by ${message.author.tag}, thread: ${threadId})`,
          )
        }
      } catch (threadErr) {
        console.error('[messageCreate] 建立討論串失敗:', threadErr)
      }
    } catch (err) {
      console.error('[messageCreate] 處理訊息事件時發生錯誤:', err)
    }
  })
}
