import {
  Client,
  Events,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  Interaction,
} from 'discord.js'

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

/**
 * 路由 ChatInputCommandInteraction 到對應的 handler
 */
async function routeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction
  const sub = interaction.options.getSubcommand(false)

  switch (commandName) {
    case 'ticket':
      switch (sub) {
        case 'create':  return handleTicketCreate(interaction)
        case 'status':  return handleTicketStatus(interaction)
        case 'reply':   return handleTicketReply(interaction)
        case 'close':   return handleTicketClose(interaction)
        default: await interaction.reply({ content: '未知的子指令。', ephemeral: true })
      }
      break

    case 'feedback':
      switch (sub) {
        case 'submit':  return handleFeedbackSubmit(interaction)
        case 'list':    return handleFeedbackList(interaction)
        case 'vote':    return handleFeedbackVote(interaction)
        default: await interaction.reply({ content: '未知的子指令。', ephemeral: true })
      }
      break

    case 'profile':
      switch (sub) {
        case 'view':    return handleProfileView(interaction)
        case 'edit':    return handleProfileEdit(interaction)
        default: await interaction.reply({ content: '未知的子指令。', ephemeral: true })
      }
      break

    case 'event':
      switch (sub) {
        case 'list':    return handleEventList(interaction)
        case 'join':    return handleEventJoin(interaction)
        case 'leave':   return handleEventLeave(interaction)
        default: await interaction.reply({ content: '未知的子指令。', ephemeral: true })
      }
      break

    case 'mod':
      switch (sub) {
        case 'ticket-status':   return handleModTicketStatus(interaction)
        case 'ticket-assign':   return handleModTicketAssign(interaction)
        case 'feedback-review': return handleModFeedbackReview(interaction)
        case 'warn':            return handleModWarn(interaction)
        case 'timeout':         return handleModTimeout(interaction)
        case 'kick':            return handleModKick(interaction)
        default: await interaction.reply({ content: '未知的子指令。', ephemeral: true })
      }
      break

    default:
      await interaction.reply({ content: '未知的指令。', ephemeral: true })
  }
}

/**
 * 路由 ModalSubmitInteraction 到對應的 handler
 */
async function routeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction

  if (customId.startsWith('profile-edit:')) {
    return handleProfileEditSubmit(interaction)
  }

  await interaction.reply({ content: '未知的表單提交。', ephemeral: true })
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
