import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

const EMBED_COLOR = 0x7c9070

/**
 * /event list
 */
export async function handleEventList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.editReply('此指令只能在伺服器中使用。')
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply('此伺服器尚未在 SusLab 系統中設定。')
    return
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('server_id', serverId)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[event] 查詢活動失敗:', error)
    await interaction.editReply('查詢活動時發生錯誤，請稍後再試。')
    return
  }

  if (!events?.length) {
    await interaction.editReply('目前沒有即將舉辦的活動。')
    return
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('📅 即將舉辦的活動')
    .setDescription(
      events
        .map((e) => {
          const shortId = (e.id as string).slice(0, 8)
          const dateStr = `${e.date as string}${e.time ? ` ${e.time as string}` : ''}`
          const location = e.location ? ` • 📍 ${e.location as string}` : ''
          const attendees = e.attendees != null ? ` • 👥 ${e.attendees as number} 人` : ''
          return `**\`${shortId}\`** ${e.title as string}\n📆 ${dateStr}${location}${attendees}`
        })
        .join('\n\n'),
    )
    .setFooter({ text: '使用 /event join <id> 報名活動' })
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /event join
 */
export async function handleEventJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const guildId = interaction.guildId

  if (!guildId) {
    await interaction.editReply('此指令只能在伺服器中使用。')
    return
  }

  const userId = await resolveSupabaseUserId(discordUserId)
  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定，才能報名活動。')
    return
  }

  const eventIdPrefix = interaction.options.getString('event-id', true)

  // 模糊查詢活動
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .ilike('id', `${eventIdPrefix}%`)
    .limit(1)
    .single()

  if (fetchError || !event) {
    await interaction.editReply('找不到對應的活動。')
    return
  }

  // 檢查是否已報名
  const { data: existing } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .single()

  if (existing) {
    await interaction.editReply('你已經報名此活動了。')
    return
  }

  // 新增報名紀錄
  const { error: regError } = await supabase
    .from('event_registrations')
    .insert({ event_id: event.id, user_id: userId })

  if (regError) {
    console.error('[event] 報名活動失敗:', regError)
    await interaction.editReply('報名活動時發生錯誤，請稍後再試。')
    return
  }

  // 更新報名人數
  const currentAttendees = (event.attendees as number) ?? 0
  await supabase
    .from('events')
    .update({ attendees: currentAttendees + 1 })
    .eq('id', event.id)

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('✅ 報名成功')
    .setDescription(`你已成功報名「**${event.title as string}**」！`)
    .addFields(
      { name: '日期', value: `${event.date as string}${event.time ? ` ${event.time as string}` : ''}`, inline: true },
    )

  if (event.location) {
    embed.addFields({ name: '地點', value: event.location as string, inline: true })
  }

  embed.setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}

/**
 * /event leave
 */
export async function handleEventLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定。')
    return
  }

  const eventIdPrefix = interaction.options.getString('event-id', true)

  // 模糊查詢活動
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .ilike('id', `${eventIdPrefix}%`)
    .limit(1)
    .single()

  if (fetchError || !event) {
    await interaction.editReply('找不到對應的活動。')
    return
  }

  // 刪除報名紀錄
  const { error: deleteError, count } = await supabase
    .from('event_registrations')
    .delete({ count: 'exact' })
    .eq('event_id', event.id)
    .eq('user_id', userId)

  if (deleteError) {
    console.error('[event] 取消報名失敗:', deleteError)
    await interaction.editReply('取消報名時發生錯誤，請稍後再試。')
    return
  }

  if (!count || count === 0) {
    await interaction.editReply('你並未報名此活動。')
    return
  }

  // 更新報名人數（不低於 0）
  const currentAttendees = (event.attendees as number) ?? 1
  await supabase
    .from('events')
    .update({ attendees: Math.max(0, currentAttendees - 1) })
    .eq('id', event.id)

  await interaction.editReply(`✅ 已取消報名「**${event.title as string}**」。`)
}
