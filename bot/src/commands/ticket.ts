import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'
import { type TFunction } from '../i18n/index.js'

const EMBED_COLOR = 0x7c9070

/**
 * 根據票券狀態取得本地化標籤
 */
function getStatusLabel(status: string, t: TFunction): string {
  const map: Record<string, string> = {
    open:        t('bot.ticket.statusOpen'),
    in_progress: t('bot.ticket.statusInProgress'),
    resolved:    t('bot.ticket.statusResolved'),
    closed:      t('bot.ticket.statusClosed'),
  }
  return map[status] ?? status
}

/**
 * 根據優先度取得本地化標籤
 */
function getPriorityLabel(priority: string, t: TFunction): string {
  const map: Record<string, string> = {
    low:    t('bot.ticket.priorityLow'),
    normal: t('bot.ticket.priorityNormal'),
    high:   t('bot.ticket.priorityHigh'),
    urgent: t('bot.ticket.priorityUrgent'),
  }
  return map[priority] ?? priority
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
export async function handleTicketCreate(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const guildId = interaction.guildId

  if (!guildId) {
    await interaction.editReply(t('bot.common.guildOnly'))
    return
  }

  const userId = await resolveSupabaseUserId(discordUserId)
  if (!userId) {
    await interaction.editReply(t('bot.common.linkRequired'))
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply(t('bot.common.serverNotSetup'))
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
    await interaction.editReply(t('bot.ticket.createError'))
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
            .setTitle(t('bot.ticket.embedTitle', { shortId }))
            .setDescription(`**${title}**`)
            .addFields(
              { name: t('bot.ticket.fieldCategory'), value: category, inline: true },
              { name: t('bot.ticket.fieldPriority'), value: getPriorityLabel(priority, t), inline: true },
              { name: t('bot.ticket.fieldStatus'), value: getStatusLabel('open', t), inline: true },
            )
            .setFooter({ text: t('bot.ticket.footerCreatedBy', { tag: interaction.user.tag }) })
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
    .setTitle(t('bot.ticket.createSuccess'))
    .addFields(
      { name: t('bot.ticket.fieldId'), value: `\`${shortId}\``, inline: true },
      { name: t('bot.ticket.fieldTitle'), value: title, inline: true },
      { name: t('bot.ticket.fieldCategory'), value: category, inline: true },
      { name: t('bot.ticket.fieldPriority'), value: getPriorityLabel(priority, t), inline: true },
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /ticket status
 */
export async function handleTicketStatus(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply(t('bot.common.linkRequiredSimple'))
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id')

  if (ticketIdPrefix) {
    // 查詢指定票券
    const ticket = await findTicketByPrefix(ticketIdPrefix, userId)
    if (!ticket) {
      await interaction.editReply(t('bot.ticket.notFoundOrNoAccess'))
      return
    }

    const shortId = (ticket.id as string).slice(0, 8)

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(t('bot.ticket.embedTitle', { shortId }))
      .setDescription(`**${ticket.title as string}**`)
      .addFields(
        { name: t('bot.ticket.fieldStatus'), value: getStatusLabel(ticket.status as string, t), inline: true },
        { name: t('bot.ticket.fieldPriority'), value: getPriorityLabel(ticket.priority as string, t), inline: true },
        { name: t('bot.ticket.fieldCategory'), value: ticket.category as string, inline: true },
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
      await interaction.editReply(t('bot.ticket.noTickets'))
      return
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(t('bot.ticket.myTicketsTitle'))
      .setDescription(
        tickets
          .map(
            (tk) =>
              `**\`${(tk.id as string).slice(0, 8)}\`** ${tk.title as string}\n${getStatusLabel(tk.status as string, t)} • ${tk.category as string}`,
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
export async function handleTicketReply(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply(t('bot.common.linkRequiredSimple'))
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const message = interaction.options.getString('message', true)

  const ticket = await findTicketByPrefix(ticketIdPrefix)
  if (!ticket) {
    await interaction.editReply(t('bot.ticket.notFound'))
    return
  }

  if (ticket.status === 'closed') {
    await interaction.editReply(t('bot.ticket.alreadyClosed'))
    return
  }

  const { error } = await supabase.from('ticket_replies').insert({
    ticket_id: ticket.id,
    content: message,
    author_id: userId,
  })

  if (error) {
    console.error('[ticket] 新增回覆失敗:', error)
    await interaction.editReply(t('bot.ticket.replyError'))
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

  const shortId = (ticket.id as string).slice(0, 8)
  await interaction.editReply(t('bot.ticket.replySuccess', { shortId }))
}

/**
 * /ticket close
 */
export async function handleTicketClose(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply(t('bot.common.linkRequiredSimple'))
    return
  }

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const ticket = await findTicketByPrefix(ticketIdPrefix, userId)

  if (!ticket) {
    await interaction.editReply(t('bot.ticket.notFoundOrNoAccess'))
    return
  }

  if (ticket.status === 'closed') {
    await interaction.editReply(t('bot.ticket.alreadyClosedState'))
    return
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'closed' })
    .eq('id', ticket.id)

  if (error) {
    console.error('[ticket] 關閉票券失敗:', error)
    await interaction.editReply(t('bot.ticket.closeError'))
    return
  }

  const shortId = (ticket.id as string).slice(0, 8)
  await interaction.editReply(t('bot.ticket.closedSuccess', { shortId }))
}
