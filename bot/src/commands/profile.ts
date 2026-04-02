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

const EMBED_COLOR = 0x7c9070

/**
 * /profile view
 */
export async function handleProfileView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // 判斷要查看的使用者
  const targetDiscordUser = interaction.options.getUser('user') ?? interaction.user
  const targetUserId = await resolveSupabaseUserId(targetDiscordUser.id)

  if (!targetUserId) {
    const isSelf = targetDiscordUser.id === interaction.user.id
    await interaction.editReply(
      isSelf
        ? '請先前往 SusLab Dashboard 完成帳號綁定，才能查看個人資料。'
        : `此使用者尚未綁定 SusLab 帳號。`,
    )
    return
  }

  const { data: profile, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .single()

  if (error || !profile) {
    await interaction.editReply('找不到此使用者的個人資料。')
    return
  }

  const visibility = (profile.visibility as Record<string, unknown>) ?? {}
  const isPrivate = visibility['profile'] === 'private'
  const isSelf = targetDiscordUser.id === interaction.user.id

  // 非本人且設為私人
  if (isPrivate && !isSelf) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`${targetDiscordUser.username} 的個人資料`)
      .setThumbnail(targetDiscordUser.displayAvatarURL())
      .setDescription('此使用者的個人資料為私人。')
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
    .setTitle(`${targetDiscordUser.username} 的個人資料`)
    .setThumbnail(targetDiscordUser.displayAvatarURL())
    .setTimestamp()

  if (showBio && profile.bio) {
    embed.setDescription(profile.bio as string)
  }

  if (showSkills && profile.skill_tags) {
    const tags = profile.skill_tags as string[]
    if (tags.length > 0) {
      embed.addFields({ name: '🛠 技能標籤', value: tags.join(', ') })
    }
  }

  if (showSocial && profile.social_links) {
    const links = profile.social_links as Record<string, string>
    const linkText = Object.entries(links)
      .filter(([, url]) => url)
      .map(([platform, url]) => `[${platform}](${url})`)
      .join(' • ')

    if (linkText) {
      embed.addFields({ name: '🔗 社群連結', value: linkText })
    }
  }

  await interaction.editReply({ embeds: [embed] })
}

/**
 * /profile edit — 顯示 Modal
 */
export async function handleProfileEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordUserId = interaction.user.id
  const userId = await resolveSupabaseUserId(discordUserId)

  if (!userId) {
    await interaction.reply({
      content: '請先前往 SusLab Dashboard 完成帳號綁定，才能編輯個人資料。',
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
    .setTitle('編輯個人資料')

  const bioInput = new TextInputBuilder()
    .setCustomId('bio')
    .setLabel('自我介紹')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500)
    .setPlaceholder('簡單介紹一下自己吧～')

  if (profile?.bio) {
    bioInput.setValue(profile.bio as string)
  }

  const skillsInput = new TextInputBuilder()
    .setCustomId('skill_tags')
    .setLabel('技能標籤（以逗號分隔）')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200)
    .setPlaceholder('例：TypeScript, React, Rust')

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
export async function handleProfileEditSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // customId 格式: profile-edit:<userId>
  const userId = interaction.customId.split(':')[1]

  if (!userId) {
    await interaction.editReply('無法識別使用者身份，請重試。')
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
    await interaction.editReply('更新個人資料時發生錯誤，請稍後再試。')
    return
  }

  await interaction.editReply('✅ 個人資料已更新！')
}
