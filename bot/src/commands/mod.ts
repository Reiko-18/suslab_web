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

const EMBED_COLOR = 0x7c9070

const MODERATOR_ROLES = new Set(['moderator', 'admin'])

/**
 * 檢查執行者是否有管理員權限
 */
async function assertModerator(
  interaction: ChatInputCommandInteraction,
): Promise<{ actorUserId: string; serverId: string } | null> {
  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.editReply('此指令只能在伺服器中使用。')
    return null
  }

  const actorUserId = await resolveSupabaseUserId(interaction.user.id)
  if (!actorUserId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定。')
    return null
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply('此伺服器尚未在 SusLab 系統中設定。')
    return null
  }

  const role = await getUserRoleInServer(actorUserId, serverId)
  if (!MODERATOR_ROLES.has(role)) {
    await interaction.editReply('你沒有足夠的權限使用此指令。')
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
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
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
    await interaction.editReply('找不到對應的票券。')
    return
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticket.id)

  if (updateError) {
    console.error('[mod] 更新票券狀態失敗:', updateError)
    await interaction.editReply('更新票券狀態時發生錯誤，請稍後再試。')
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
              .setTitle('票券狀態更新')
              .setDescription(`狀態已由 **${ticket.status as string}** 更新為 **${newStatus}**`)
              .setFooter({ text: `由 ${interaction.user.tag} 操作` })
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

  await interaction.editReply(
    `✅ 票券 \`${(ticket.id as string).slice(0, 8)}\` 狀態已更新為 **${newStatus}**。`,
  )
}

/**
 * /mod ticket-assign
 */
export async function handleModTicketAssign(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
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
    await interaction.editReply('找不到對應的票券。')
    return
  }

  const assigneeUserId = await resolveSupabaseUserId(targetDiscordUser.id)
  if (!assigneeUserId) {
    await interaction.editReply('該使用者尚未綁定 SusLab 帳號。')
    return
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ assigned_to: assigneeUserId })
    .eq('id', ticket.id)

  if (updateError) {
    console.error('[mod] 指派票券失敗:', updateError)
    await interaction.editReply('指派票券時發生錯誤，請稍後再試。')
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

  await interaction.editReply(
    `✅ 票券 \`${(ticket.id as string).slice(0, 8)}\` 已指派給 ${targetDiscordUser.toString()}。`,
  )
}

/**
 * /mod feedback-review
 */
export async function handleModFeedbackReview(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
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
    await interaction.editReply('找不到對應的回饋項目。')
    return
  }

  const { error: updateError } = await supabase
    .from('feedbacks')
    .update({ status: newStatus })
    .eq('id', feedback.id)

  if (updateError) {
    console.error('[mod] 更新回饋狀態失敗:', updateError)
    await interaction.editReply('更新回饋狀態時發生錯誤，請稍後再試。')
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

  await interaction.editReply(
    `✅ 回饋 \`${(feedback.id as string).slice(0, 8)}\` 狀態已更新為 **${newStatus}**。`,
  )
}

/**
 * /mod warn
 */
export async function handleModWarn(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
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

  // 嘗試 DM 使用者
  try {
    const dmChannel = await targetDiscordUser.createDM()
    await dmChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle('⚠️ 你收到一則警告')
          .setDescription(`**原因：** ${reason}`)
          .setFooter({ text: `來自 ${interaction.guild?.name ?? '未知伺服器'}` })
          .setTimestamp(),
      ],
    })
  } catch (dmErr) {
    console.error('[mod] 無法發送 DM 警告:', dmErr)
  }

  const logNote = targetUserId ? '' : '（使用者未綁定帳號，未記錄至 Supabase）'
  await interaction.editReply(
    `✅ 已警告 ${targetDiscordUser.toString()}。原因：${reason} ${logNote}`,
  )
}

/**
 * /mod timeout
 */
export async function handleModTimeout(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
  if (!auth) return

  const targetDiscordUser = interaction.options.getUser('user', true)
  const durationMinutes = interaction.options.getInteger('duration', true)
  const reason = interaction.options.getString('reason') ?? '未說明原因'

  const guildMember = interaction.guild?.members.cache.get(targetDiscordUser.id) as
    | GuildMember
    | undefined

  if (!guildMember) {
    await interaction.editReply('找不到此伺服器成員。')
    return
  }

  try {
    await guildMember.timeout(durationMinutes * 60 * 1000, reason)
  } catch (timeoutErr) {
    console.error('[mod] 禁言失敗:', timeoutErr)
    await interaction.editReply('禁言失敗，可能是因為機器人權限不足或目標為管理員。')
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
    `✅ 已禁言 ${targetDiscordUser.toString()} **${durationMinutes} 分鐘**。原因：${reason}`,
  )
}

/**
 * /mod kick
 */
export async function handleModKick(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const auth = await assertModerator(interaction)
  if (!auth) return

  const targetDiscordUser = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason') ?? '未說明原因'

  const guildMember = interaction.guild?.members.cache.get(targetDiscordUser.id) as
    | GuildMember
    | undefined

  if (!guildMember) {
    await interaction.editReply('找不到此伺服器成員。')
    return
  }

  try {
    await guildMember.kick(reason)
  } catch (kickErr) {
    console.error('[mod] 踢除失敗:', kickErr)
    await interaction.editReply('踢除失敗，可能是因為機器人權限不足或目標為管理員。')
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
    `✅ 已踢除 **${targetDiscordUser.tag}**。原因：${reason}`,
  )
}
