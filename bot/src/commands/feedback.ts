import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'

const EMBED_COLOR = 0x7c9070

const CATEGORY_LABELS: Record<string, string> = {
  feature: '💡 功能建議',
  event: '🎉 活動建議',
  bug: '🐛 錯誤回報',
}

/**
 * /feedback submit
 */
export async function handleFeedbackSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const guildId = interaction.guildId

  if (!guildId) {
    await interaction.editReply('此指令只能在伺服器中使用。')
    return
  }

  const userId = await resolveSupabaseUserId(discordUserId)
  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定，才能提交回饋。')
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply('此伺服器尚未在 SusLab 系統中設定。')
    return
  }

  const category = interaction.options.getString('category', true)
  const title = interaction.options.getString('title', true)
  const description = interaction.options.getString('description', true)

  const { data: feedback, error } = await supabase
    .from('feedbacks')
    .insert({
      author_id: userId,
      category,
      title,
      content: description,
      status: 'pending',
      vote_count: 0,
      server_id: serverId,
    })
    .select()
    .single()

  if (error || !feedback) {
    console.error('[feedback] 提交回饋失敗:', error)
    await interaction.editReply('提交回饋時發生錯誤，請稍後再試。')
    return
  }

  const shortId = (feedback.id as string).slice(0, 8)

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('✅ 回饋已提交')
    .addFields(
      { name: 'ID', value: `\`${shortId}\``, inline: true },
      { name: '分類', value: CATEGORY_LABELS[category] ?? category, inline: true },
      { name: '標題', value: title },
      { name: '描述', value: description },
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /feedback list
 */
export async function handleFeedbackList(interaction: ChatInputCommandInteraction): Promise<void> {
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

  const category = interaction.options.getString('category')

  let query = supabase
    .from('feedbacks')
    .select('*')
    .eq('server_id', serverId)
    .order('vote_count', { ascending: false })
    .limit(10)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: feedbacks, error } = await query

  if (error) {
    console.error('[feedback] 查詢回饋列表失敗:', error)
    await interaction.editReply('查詢回饋列表時發生錯誤，請稍後再試。')
    return
  }

  if (!feedbacks?.length) {
    await interaction.editReply('目前沒有任何回饋。')
    return
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('📊 回饋列表（依票數排序）')
    .setDescription(
      feedbacks
        .map(
          (f) =>
            `**\`${(f.id as string).slice(0, 8)}\`** ${f.title as string}\n${CATEGORY_LABELS[f.category as string] ?? f.category as string} • 👍 ${f.vote_count as number} 票 • ${f.status as string}`,
        )
        .join('\n\n'),
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /feedback vote
 */
export async function handleFeedbackVote(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply('請先前往 SusLab Dashboard 完成帳號綁定，才能投票。')
    return
  }

  const feedbackIdPrefix = interaction.options.getString('feedback-id', true)

  // 模糊查詢回饋
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

  // 檢查是否已投票
  const { data: existingVote } = await supabase
    .from('feedback_votes')
    .select('feedback_id')
    .eq('feedback_id', feedback.id)
    .eq('user_id', userId)
    .single()

  if (existingVote) {
    await interaction.editReply('你已經為此回饋投過票了。')
    return
  }

  // 新增投票紀錄
  const { error: voteError } = await supabase
    .from('feedback_votes')
    .insert({ feedback_id: feedback.id, user_id: userId })

  if (voteError) {
    console.error('[feedback] 投票失敗:', voteError)
    await interaction.editReply('投票時發生錯誤，請稍後再試。')
    return
  }

  // 更新票數（讀取當前值後加 1）
  const currentVotes = (feedback.vote_count as number) ?? 0
  await supabase
    .from('feedbacks')
    .update({ vote_count: currentVotes + 1 })
    .eq('id', feedback.id)

  await interaction.editReply(
    `👍 已為「**${feedback.title as string}**」投票！目前共 ${currentVotes + 1} 票。`,
  )
}
