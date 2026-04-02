import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js'
import { supabase } from '../services/supabase.js'
import {
  resolveSupabaseUserId,
  getServerIdFromGuild,
  getUserRoleInServer,
} from '../services/discord.js'
import { type TFunction, getT } from '../i18n/index.js'
import { getUserLocale } from '../services/userSettings.js'

const EMBED_COLOR = 0x7c9070

const MODERATOR_ROLES = new Set(['moderator', 'admin'])

/**
 * 檢查執行者是否有管理員權限
 */
async function assertModerator(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<{ actorUserId: string; serverId: string } | null> {
  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.editReply(t('bot.common.guildOnly'))
    return null
  }

  const actorUserId = await resolveSupabaseUserId(interaction.user.id)
  if (!actorUserId) {
    await interaction.editReply(t('bot.common.linkRequiredSimple'))
    return null
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply(t('bot.common.serverNotSetup'))
    return null
  }

  const role = await getUserRoleInServer(actorUserId, serverId)
  if (!MODERATOR_ROLES.has(role)) {
    await interaction.editReply(t('bot.common.noPermission'))
    return null
  }

  return { actorUserId, serverId }
}

/**
 * 寫入稽核日誌
 */
async function writeAuditLog(params: {
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  targetName: string
  details?: string
  serverId: string
}): Promise<void> {
  const { error } = await supabase.from('admin_audit_logs').insert({
    actor_id: params.actorId,
    actor_name: params.actorName,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    target_name: params.targetName,
    details: params.details ?? null,
    server_id: params.serverId,
  })

  if (error) {
    console.error('[mod] 寫入稽核日誌失敗:', error)
  }
}

/**
 * /mod ticket-status
 */
export async function handleModTicketStatus(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const newStatus = interaction.options.getString('status', true)

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('*')
    .ilike('id', `${ticketIdPrefix}%`)
    .limit(1)
    .single()

  if (fetchError || !ticket) {
    await interaction.editReply(t('bot.mod.ticketNotFound'))
    return
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticket.id)

  if (updateError) {
    console.error('[mod] 更新票券狀態失敗:', updateError)
    await interaction.editReply(t('bot.mod.ticketStatusError'))
    return
  }

  // 若票券有 Discord 討論串，發布狀態更新訊息
  if (ticket.discord_thread_id) {
    try {
      const thread = await interaction.client.channels.fetch(ticket.discord_thread_id as string)
      if (thread && thread.isThread()) {
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setTitle(t('bot.mod.ticketStatusUpdateTitle'))
              .setDescription(
                t('bot.mod.ticketStatusUpdateDesc', {
                  from: ticket.status as string,
                  to: newStatus,
                }),
              )
              .setFooter({ text: t('bot.mod.ticketStatusUpdateFooter', { tag: interaction.user.tag }) })
              .setTimestamp(),
          ],
        })
      }
    } catch (threadErr) {
      console.error('[mod] 發送討論串訊息失敗:', threadErr)
    }
  }

  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'update_ticket_status',
    targetType: 'ticket',
    targetId: ticket.id as string,
    targetName: ticket.title as string,
    details: `${ticket.status as string} → ${newStatus}`,
    serverId: auth.serverId,
  })

  const shortId = (ticket.id as string).slice(0, 8)
  await interaction.editReply(
    t('bot.mod.ticketStatusSuccess', { shortId, status: newStatus }),
  )
}

/**
 * /mod ticket-assign
 */
export async function handleModTicketAssign(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const ticketIdPrefix = interaction.options.getString('ticket-id', true)
  const targetDiscordUser = interaction.options.getUser('user', true)

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('*')
    .ilike('id', `${ticketIdPrefix}%`)
    .limit(1)
    .single()

  if (fetchError || !ticket) {
    await interaction.editReply(t('bot.mod.ticketNotFound'))
    return
  }

  const assigneeUserId = await resolveSupabaseUserId(targetDiscordUser.id)
  if (!assigneeUserId) {
    await interaction.editReply(t('bot.mod.ticketAssignUserNotBound'))
    return
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ assigned_to: assigneeUserId })
    .eq('id', ticket.id)

  if (updateError) {
    console.error('[mod] 指派票券失敗:', updateError)
    await interaction.editReply(t('bot.mod.ticketAssignError'))
    return
  }

  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'assign_ticket',
    targetType: 'ticket',
    targetId: ticket.id as string,
    targetName: ticket.title as string,
    details: `指派給 ${targetDiscordUser.tag}`,
    serverId: auth.serverId,
  })

  const shortId = (ticket.id as string).slice(0, 8)
  await interaction.editReply(
    t('bot.mod.ticketAssignSuccess', { shortId, user: targetDiscordUser.toString() }),
  )
}

/**
 * /mod feedback-review
 */
export async function handleModFeedbackReview(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const feedbackIdPrefix = interaction.options.getString('feedback-id', true)
  const newStatus = interaction.options.getString('status', true)

  const { data: feedback, error: fetchError } = await supabase
    .from('feedbacks')
    .select('*')
    .ilike('id', `${feedbackIdPrefix}%`)
    .limit(1)
    .single()

  if (fetchError || !feedback) {
    await interaction.editReply(t('bot.mod.feedbackNotFound'))
    return
  }

  const { error: updateError } = await supabase
    .from('feedbacks')
    .update({ status: newStatus })
    .eq('id', feedback.id)

  if (updateError) {
    console.error('[mod] 更新回饋狀態失敗:', updateError)
    await interaction.editReply(t('bot.mod.feedbackStatusError'))
    return
  }

  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'review_feedback',
    targetType: 'feedback',
    targetId: feedback.id as string,
    targetName: feedback.title as string,
    details: `狀態更新為 ${newStatus}`,
    serverId: auth.serverId,
  })

  const shortId = (feedback.id as string).slice(0, 8)
  await interaction.editReply(
    t('bot.mod.feedbackStatusSuccess', { shortId, status: newStatus }),
  )
}

/**
 * /mod warn
 */
export async function handleModWarn(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const targetDiscordUser = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason', true)

  const targetUserId = await resolveSupabaseUserId(targetDiscordUser.id)

  // 寫入稽核日誌
  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'warn_user',
    targetType: 'user',
    targetId: targetDiscordUser.id,
    targetName: targetDiscordUser.tag,
    details: reason,
    serverId: auth.serverId,
  })

  // 嘗試 DM 使用者 — 使用目標使用者的語言
  try {
    const targetLocale = await getUserLocale(targetDiscordUser.id, undefined)
    const targetT = getT(targetLocale)
    const dmChannel = await targetDiscordUser.createDM()
    await dmChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle(targetT('bot.mod.warnDmTitle'))
          .setDescription(targetT('bot.mod.warnDmReason', { reason }))
          .setFooter({ text: targetT('bot.mod.warnDmFooter', { guild: interaction.guild?.name ?? targetT('bot.mod.warnUnknownGuild') }) })
          .setTimestamp(),
      ],
    })
  } catch (dmErr) {
    console.error('[mod] 無法發送 DM 警告:', dmErr)
  }

  const logNote = targetUserId ? '' : t('bot.mod.warnLogNote')
  await interaction.editReply(
    t('bot.mod.warnSuccess', { user: targetDiscordUser.toString(), reason, logNote }),
  )
}

/**
 * /mod timeout
 */
export async function handleModTimeout(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const targetDiscordUser = interaction.options.getUser('user', true)
  const durationMinutes = interaction.options.getInteger('duration', true)
  const reason = interaction.options.getString('reason') ?? t('bot.mod.timeoutDefaultReason')

  const guildMember = interaction.guild?.members.cache.get(targetDiscordUser.id) as
    | GuildMember
    | undefined

  if (!guildMember) {
    await interaction.editReply(t('bot.common.memberNotFound'))
    return
  }

  try {
    await guildMember.timeout(durationMinutes * 60 * 1000, reason)
  } catch (timeoutErr) {
    console.error('[mod] 禁言失敗:', timeoutErr)
    await interaction.editReply(t('bot.mod.timeoutFailed'))
    return
  }

  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'timeout_user',
    targetType: 'user',
    targetId: targetDiscordUser.id,
    targetName: targetDiscordUser.tag,
    details: `禁言 ${durationMinutes} 分鐘，原因：${reason}`,
    serverId: auth.serverId,
  })

  await interaction.editReply(
    t('bot.mod.timeoutSuccess', { user: targetDiscordUser.toString(), duration: durationMinutes, reason }),
  )
}

/**
 * /mod kick
 */
export async function handleModKick(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction, t)
  if (!auth) return

  const targetDiscordUser = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason') ?? t('bot.mod.kickDefaultReason')

  const guildMember = interaction.guild?.members.cache.get(targetDiscordUser.id) as
    | GuildMember
    | undefined

  if (!guildMember) {
    await interaction.editReply(t('bot.common.memberNotFound'))
    return
  }

  try {
    await guildMember.kick(reason)
  } catch (kickErr) {
    console.error('[mod] 踢除失敗:', kickErr)
    await interaction.editReply(t('bot.mod.kickFailed'))
    return
  }

  await writeAuditLog({
    actorId: auth.actorUserId,
    actorName: interaction.user.tag,
    action: 'kick_user',
    targetType: 'user',
    targetId: targetDiscordUser.id,
    targetName: targetDiscordUser.tag,
    details: `原因：${reason}`,
    serverId: auth.serverId,
  })

  await interaction.editReply(
    t('bot.mod.kickSuccess', { tag: targetDiscordUser.tag, reason }),
  )
}
