import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { SUPPORTED_LOCALES, type SupportedLocale, getT } from '../i18n/index.js'
import type { TFunction } from '../i18n/index.js'
import { resolveSupabaseUserId } from '../services/discord.js'
import { getUserLocale, setUserLocale } from '../services/userSettings.js'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
}

export async function handleSettingsCommand(
  cmd: ChatInputCommandInteraction,
  t: TFunction,
): Promise<void> {
  const sub = cmd.options.getSubcommand()

  if (sub === 'language') {
    const locale = cmd.options.getString('language', true)

    // 驗證 locale 是否在支援清單內
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      await cmd.reply({ content: t('bot.common.genericError'), ephemeral: true })
      return
    }

    const userId = await resolveSupabaseUserId(cmd.user.id)
    if (!userId) {
      await cmd.reply({ content: t('bot.settings.linkRequired'), ephemeral: true })
      return
    }

    await setUserLocale(userId, cmd.user.id, locale as SupportedLocale)

    // 以新選擇的語言回覆
    const newT = getT(locale)
    await cmd.reply({
      content: newT('bot.settings.languageUpdated', { language: LANGUAGE_NAMES[locale] ?? locale }),
      ephemeral: true,
    })
    return
  }

  if (sub === 'view') {
    const currentLocale = await getUserLocale(cmd.user.id, cmd.locale)
    const viewT = getT(currentLocale)

    const embed = new EmbedBuilder()
      .setTitle(viewT('bot.settings.viewTitle'))
      .addFields({
        name: viewT('bot.settings.languageLabel'),
        value: LANGUAGE_NAMES[currentLocale] ?? currentLocale,
        inline: true,
      })
      .setColor(0x7c9070)

    await cmd.reply({ embeds: [embed], ephemeral: true })
    return
  }

  // 未知子指令
  await cmd.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
}
