import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId, getServerIdFromGuild } from '../services/discord.js'
import { type TFunction } from '../i18n/index.js'

const EMBED_COLOR = 0x7c9070

/**
 * 根據分類取得本地化標籤
 */
function getCategoryLabel(category: string, t: TFunction): string {
  const map: Record<string, string> = {
    feature: t('bot.feedback.categoryFeature'),
    event:   t('bot.feedback.categoryEvent'),
    bug:     t('bot.feedback.categoryBug'),
  }
  return map[category] ?? category
}

/**
 * /feedback submit
 */
export async function handleFeedbackSubmit(
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
    await interaction.editReply(t('bot.common.linkRequiredFeedback'))
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply(t('bot.common.serverNotSetup'))
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
    await interaction.editReply(t('bot.feedback.submitError'))
    return
  }

  const shortId = (feedback.id as string).slice(0, 8)

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(t('bot.feedback.submitSuccess'))
    .addFields(
      { name: t('bot.feedback.fieldId'), value: `\`${shortId}\``, inline: true },
      { name: t('bot.feedback.fieldCategory'), value: getCategoryLabel(category, t), inline: true },
      { name: t('bot.feedback.fieldTitle'), value: title },
      { name: t('bot.feedback.fieldDescription'), value: description },
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /feedback list
 */
export async function handleFeedbackList(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.editReply(t('bot.common.guildOnly'))
    return
  }

  const serverId = await getServerIdFromGuild(guildId)
  if (!serverId) {
    await interaction.editReply(t('bot.common.serverNotSetup'))
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
    await interaction.editReply(t('bot.feedback.listError'))
    return
  }

  if (!feedbacks?.length) {
    await interaction.editReply(t('bot.feedback.noFeedbacks'))
    return
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(t('bot.feedback.listTitle'))
    .setDescription(
      feedbacks
        .map(
          (f) =>
            `**\`${(f.id as string).slice(0, 8)}\`** ${f.title as string}\n${getCategoryLabel(f.category as string, t)} • 👍 ${f.vote_count as number} 票 • ${f.status as string}`,
        )
        .join('\n\n'),
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /feedback vote
 */
export async function handleFeedbackVote(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.editReply(t('bot.common.linkRequiredVote'))
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
    await interaction.editReply(t('bot.feedback.notFound'))
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
    await interaction.editReply(t('bot.feedback.alreadyVoted'))
    return
  }

  // 新增投票紀錄
  const { error: voteError } = await supabase
    .from('feedback_votes')
    .insert({ feedback_id: feedback.id, user_id: userId })

  if (voteError) {
    console.error('[feedback] 投票失敗:', voteError)
    await interaction.editReply(t('bot.feedback.voteError'))
    return
  }

  // 更新票數（讀取當前值後加 1）
  const currentVotes = (feedback.vote_count as number) ?? 0
  await supabase
    .from('feedbacks')
    .update({ vote_count: currentVotes + 1 })
    .eq('id', feedback.id)

  await interaction.editReply(
    t('bot.feedback.voteSuccess', { title: feedback.title as string, count: currentVotes + 1 }),
  )
}
