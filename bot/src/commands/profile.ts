import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js'
import { supabase } from '../services/supabase.js'
import { resolveSupabaseUserId } from '../services/discord.js'
import { type TFunction } from '../i18n/index.js'

const EMBED_COLOR = 0x7c9070

/**
 * /profile view
 */
export async function handleProfileView(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // 判斷要查看的使用者
  const targetDiscordUser = interaction.options.getUser('user') ?? interaction.user
  const targetUserId = await resolveSupabaseUserId(targetDiscordUser.id)

  if (!targetUserId) {
    const isSelf = targetDiscordUser.id === interaction.user.id
    await interaction.editReply(
      isSelf
        ? t('bot.common.linkRequiredProfile')
        : t('bot.profile.notBound'),
    )
    return
  }

  const { data: profile, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .single()

  if (error || !profile) {
    await interaction.editReply(t('bot.profile.notFound'))
    return
  }

  const visibility = (profile.visibility as Record<string, unknown>) ?? {}
  const isPrivate = visibility['profile'] === 'private'
  const isSelf = targetDiscordUser.id === interaction.user.id

  // 非本人且設為私人
  if (isPrivate && !isSelf) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(t('bot.profile.embedTitle', { username: targetDiscordUser.username }))
      .setThumbnail(targetDiscordUser.displayAvatarURL())
      .setDescription(t('bot.profile.isPrivate'))
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
    return
  }

  const visibleFields = (visibility['fields'] as string[]) ?? []
  const showBio = isSelf || visibleFields.includes('bio') || visibleFields.length === 0
  const showSkills = isSelf || visibleFields.includes('skill_tags') || visibleFields.length === 0
  const showSocial = isSelf || visibleFields.includes('social_links') || visibleFields.length === 0

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(t('bot.profile.embedTitle', { username: targetDiscordUser.username }))
    .setThumbnail(targetDiscordUser.displayAvatarURL())
    .setTimestamp()

  if (showBio && profile.bio) {
    embed.setDescription(profile.bio as string)
  }

  if (showSkills && profile.skill_tags) {
    const tags = profile.skill_tags as string[]
    if (tags.length > 0) {
      embed.addFields({ name: t('bot.profile.fieldSkills'), value: tags.join(', ') })
    }
  }

  if (showSocial && profile.social_links) {
    const links = profile.social_links as Record<string, string>
    const linkText = Object.entries(links)
      .filter(([, url]) => url)
      .map(([platform, url]) => `[${platform}](${url})`)
      .join(' • ')

    if (linkText) {
      embed.addFields({ name: t('bot.profile.fieldSocial'), value: linkText })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /profile edit — 顯示 Modal
 */
export async function handleProfileEdit(
  interaction: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.reply({
      content: t('bot.common.linkRequiredEdit'),
      ephemeral: true,
    })
    return
  }

  // 讀取現有資料預填 Modal
  const { data: profile } = await supabase
    .from('member_profiles')
    .select('bio, skill_tags')
    .eq('user_id', userId)
    .single()

  const modal = new ModalBuilder()
    .setCustomId(`profile-edit:${userId}`)
    .setTitle(t('bot.profile.modalTitle'))

  const bioInput = new TextInputBuilder()
    .setCustomId('bio')
    .setLabel(t('bot.profile.bioLabel'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500)
    .setPlaceholder(t('bot.profile.bioPlaceholder'))

  if (profile?.bio) {
    bioInput.setValue(profile.bio as string)
  }

  const skillsInput = new TextInputBuilder()
    .setCustomId('skill_tags')
    .setLabel(t('bot.profile.skillsLabel'))
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200)
    .setPlaceholder(t('bot.profile.skillsPlaceholder'))

  if (profile?.skill_tags) {
    const tags = profile.skill_tags as string[]
    skillsInput.setValue(tags.join(', '))
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(skillsInput),
  )

  await interaction.showModal(modal)
}

/**
 * Modal submit handler — 儲存個人資料
 */
export async function handleProfileEditSubmit(
  interaction: ModalSubmitInteraction,
  t: TFunction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // customId 格式: profile-edit:<userId>
  const userId = interaction.customId.split(':')[1]

  if (!userId) {
    await interaction.editReply(t('bot.profile.unknownIdentity'))
    return
  }

  const bio = interaction.fields.getTextInputValue('bio').trim()
  const skillTagsRaw = interaction.fields.getTextInputValue('skill_tags').trim()
  const skillTags = skillTagsRaw
    ? skillTagsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const { error } = await supabase
    .from('member_profiles')
    .upsert(
      { user_id: userId, bio, skill_tags: skillTags },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('[profile] 更新個人資料失敗:', error)
    await interaction.editReply(t('bot.profile.updateError'))
    return
  }

  await interaction.editReply(t('bot.profile.updateSuccess'))
}
