import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'
import { registerCommandHandler } from './commands/handler.js'
import { registerMessageCreate } from './listeners/messageCreate.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

// 註冊成員事件監聽器
registerGuildMemberAdd(client)
registerGuildMemberRemove(client)

// 註冊 Slash Command 處理器
registerCommandHandler(client)

// 註冊訊息建立監聽器（ticket 頻道自動建立票券）
registerMessageCreate(client)

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  console.log(`Serving ${c.guilds.cache.size} guilds`)
  await fullSync(client)
})

process.on('SIGINT', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Shutting down...')
  client.destroy()
  process.exit(0)
})

client.login(config.discord.token)
