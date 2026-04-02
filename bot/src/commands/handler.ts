import {
  Client,
  Events,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  Interaction,
} from 'discord.js'

import { getT, type TFunction } from '../i18n/index.js'
import { getUserLocale } from '../services/userSettings.js'
import { handleTicketCreate, handleTicketStatus, handleTicketReply, handleTicketClose } from './ticket.js'
import { handleFeedbackSubmit, handleFeedbackList, handleFeedbackVote } from './feedback.js'
import { handleProfileView, handleProfileEdit, handleProfileEditSubmit } from './profile.js'
import { handleEventList, handleEventJoin, handleEventLeave } from './event.js'
import {
  handleModTicketStatus,
  handleModTicketAssign,
  handleModFeedbackReview,
  handleModWarn,
  handleModTimeout,
  handleModKick,
} from './mod.js'
import { handleSettingsCommand } from './settings.js'

/**
 * 路由 ChatInputCommandInteraction 到對應的 handler
 */
async function routeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction
  const sub = interaction.options.getSubcommand(false)

  // 解析使用者語言，取得 t() 函式
  const locale = await getUserLocale(interaction.user.id, interaction.locale)
  const t: TFunction = getT(locale)

  switch (commandName) {
    case 'ticket':
      switch (sub) {
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'create':  return handleTicketCreate(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'status':  return handleTicketStatus(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'reply':   return handleTicketReply(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'close':   return handleTicketClose(interaction, t)
        default: await interaction.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
      }
      break

    case 'feedback':
      switch (sub) {
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'submit':  return handleFeedbackSubmit(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'list':    return handleFeedbackList(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'vote':    return handleFeedbackVote(interaction, t)
        default: await interaction.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
      }
      break

    case 'profile':
      switch (sub) {
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'view':    return handleProfileView(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'edit':    return handleProfileEdit(interaction, t)
        default: await interaction.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
      }
      break

    case 'event':
      switch (sub) {
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'list':    return handleEventList(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'join':    return handleEventJoin(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'leave':   return handleEventLeave(interaction, t)
        default: await interaction.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
      }
      break

    case 'mod':
      switch (sub) {
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'ticket-status':   return handleModTicketStatus(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'ticket-assign':   return handleModTicketAssign(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'feedback-review': return handleModFeedbackReview(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'warn':            return handleModWarn(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'timeout':         return handleModTimeout(interaction, t)
        // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
        case 'kick':            return handleModKick(interaction, t)
        default: await interaction.reply({ content: t('bot.common.unknownSubcommand'), ephemeral: true })
      }
      break

    case 'settings':
      return handleSettingsCommand(interaction, t)

    default:
      await interaction.reply({ content: t('bot.common.unknownCommand'), ephemeral: true })
  }
}

/**
 * 路由 ModalSubmitInteraction 到對應的 handler
 */
async function routeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction

  // 解析使用者語言，取得 t() 函式
  const locale = await getUserLocale(interaction.user.id, interaction.locale)
  const t: TFunction = getT(locale)

  if (customId.startsWith('profile-edit:')) {
    // @ts-expect-error - t 參數將在 Task 6 新增至 handler 簽名
    return handleProfileEditSubmit(interaction, t)
  }

  await interaction.reply({ content: t('bot.common.unknownModal'), ephemeral: true })
}

/**
 * 註冊 InteractionCreate 監聽器
 */
export function registerCommandHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await routeCommand(interaction)
      } else if (interaction.isModalSubmit()) {
        await routeModal(interaction)
      }
    } catch (err) {
      console.error('[handler] 處理互動時發生未預期錯誤:', err)

      // 嘗試回覆通用錯誤訊息
      try {
        const errorMessage = { content: '處理指令時發生錯誤，請稍後再試。', ephemeral: true }

        if (interaction.isChatInputCommand() || interaction.isModalSubmit()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorMessage.content)
          } else {
            await interaction.reply(errorMessage)
          }
        }
      } catch (replyErr) {
        console.error('[handler] 回覆錯誤訊息失敗:', replyErr)
      }
    }
  })

  console.log('[handler] 指令處理器已註冊')
}
