import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

const EMBED_COLOR = 0x7c9070

// 票券狀態中文對應
const STATUS_LABELS: Record<string, string> = {
  open: '🟢 開放中',
  in_progress: '🟡 處理中',
  resolved: '✅ 已解決',
  closed: '🔒 已關閉',
}

// 優先度中文對應
const PRIORITY_LABELS: Record<string, string> = {
  low: '🔵 低',
  normal: '⚪ 普通',
  high: '🟠 高',
  urgent: '🔴 緊急',
}

/**
 * 使用 ID 前綴模糊查詢票券
 */
async function findTicketByPrefix(ticketIdPrefix: string, userId?: string) {
  let query = supabase
    .from('tickets')
    .select('*')
    .ilike('id', `${ticketIdPrefix}%`)
    .limit(1)

  if (userId) {
    query = query.eq('created_by', userId)
  }

  const { data, error } = await query.single()
  if (error) return null
  return data
}

/**
 * /ticket create
 */
export async function handleTicketCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const guildId = interaction.guildId

  if (!guildId) {
    await interaction.editReply('此指令只能在伺服器中使用。')
    return
  }

  const userId = await resolveSupabaseUserId(discordUserId)
  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定，才能使用此功能。')
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply('此伺服器尚未在 SusLab 系統中設定。')
    return
  }

  const title = interaction.options.getString('title', true)
  const category = interaction.options.getString('category') ?? 'general'
  const priority = interaction.options.getString('priority') ?? 'normal'

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title,
      category,
      priority,
      status: 'open',
      source: 'discord',
      created_by: userId,
      server_id: serverId,
    })
    .select()
    .single()

  if (error || !ticket) {
    console.error('[ticket] 建立票券失敗:', error)
    await interaction.editReply('建立票券時發生錯誤，請稍後再試。')
    return
  }

  const shortId = (ticket.id as string).slice(0, 8)

  // 嘗試在當前頻道建立討論串
  try {
    const channel = interaction.channel
    if (channel && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel
      const thread = await textChannel.threads.create({
        name: `🎫 ${shortId} — ${title}`,
        autoArchiveDuration: 1440,
      })

      await supabase
        .from('tickets')
        .update({
          discord_channel_id: channel.id,
          discord_thread_id: thread.id,
        })
        .eq('id', ticket.id)

      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`票券 #${shortId}`)
            .setDescription(`**${title}**`)
            .addFields(
              { name: '分類', value: category, inline: true },
              { name: '優先度', value: PRIORITY_LABELS[priority] ?? priority, inline: true },
              { name: '狀態', value: STATUS_LABELS['open'], inline: true },
            )
            .setFooter({ text: `由 ${interaction.user.tag} 建立` })
            .setTimestamp(),
        ],
      })

      await thread.send('✅')
    }
  } catch (threadErr) {
    console.error('[ticket] 建立討論串失敗（繼續執行）:', threadErr)
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('✅ 票券已建立')
    .addFields(
      { name: 'ID', value: `\`${shortId}\``, inline: true },
      { name: '標題', value: title, inline: true },
      { name: '分類', value: category, inline: true },
      { name: '優先度', value: PRIORITY_LABELS[priority] ?? priority, inline: true },
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /ticket status
 */
export async function handleTicketStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定。')
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id')

  if (ticketIdPrefix) {
    // 查詢指定票券
    const ticket = await findTicketByPrefix(ticketIdPrefix, userId)
    if (!ticket) {
      await interaction.editReply('找不到對應的票券，或您沒有此票券的存取權限。')
      return
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`票券 #${(ticket.id as string).slice(0, 8)}`)
      .setDescription(`**${ticket.title as string}**`)
      .addFields(
        { name: '狀態', value: STATUS_LABELS[ticket.status as string] ?? ticket.status as string, inline: true },
        { name: '優先度', value: PRIORITY_LABELS[ticket.priority as string] ?? ticket.priority as string, inline: true },
        { name: '分類', value: ticket.category as string, inline: true },
      )
      .setTimestamp(new Date(ticket.created_at as string))

    await interaction.editReply({ embeds: [embed] })
  } else {
    // 列出最近 5 張票券
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error || !tickets?.length) {
      await interaction.editReply('你目前沒有任何票券。')
      return
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('📋 你的最近票券')
      .setDescription(
        tickets
          .map(
            (t) =>
              `**\`${(t.id as string).slice(0, 8)}\`** ${t.title as string}\n${STATUS_LABELS[t.status as string] ?? t.status as string} • ${t.category as string}`,
          )
          .join('\n\n'),
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
}

/**
 * /ticket reply
 */
export async function handleTicketReply(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定。')
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const message = interaction.options.getString('message', true)

  const ticket = await findTicketByPrefix(ticketIdPrefix)
  if (!ticket) {
    await interaction.editReply('找不到對應的票券。')
    return
  }

  if (ticket.status === 'closed') {
    await interaction.editReply('此票券已關閉，無法回覆。')
    return
  }

  const { error } = await supabase.from('ticket_replies').insert({
    ticket_id: ticket.id,
    content: message,
    author_id: userId,
  })

  if (error) {
    console.error('[ticket] 新增回覆失敗:', error)
    await interaction.editReply('回覆失敗，請稍後再試。')
    return
  }

  // 若票券有 Discord 討論串，發送回覆訊息
  if (ticket.discord_thread_id) {
    try {
      const thread = await interaction.client.channels.fetch(ticket.discord_thread_id as string)
      if (thread && thread.isThread()) {
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setDescription(message)
              .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
              .setTimestamp(),
          ],
        })
      }
    } catch (threadErr) {
      console.error('[ticket] 發送討論串回覆失敗:', threadErr)
    }
  }

  await interaction.editReply(`✅ 已回覆票券 \`${(ticket.id as string).slice(0, 8)}\`。`)
}

/**
 * /ticket close
 */
export async function handleTicketClose(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定。')
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const ticket = await findTicketByPrefix(ticketIdPrefix, userId)

  if (!ticket) {
    await interaction.editReply('找不到對應的票券，或您沒有此票券的存取權限。')
    return
  }

  if (ticket.status === 'closed') {
    await interaction.editReply('此票券已經是關閉狀態。')
    return
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'closed' })
    .eq('id', ticket.id)

  if (error) {
    console.error('[ticket] 關閉票券失敗:', error)
    await interaction.editReply('關閉票券時發生錯誤，請稍後再試。')
    return
  }

  await interaction.editReply(`🔒 票券 \`${(ticket.id as string).slice(0, 8)}\` 已關閉。`)
}
