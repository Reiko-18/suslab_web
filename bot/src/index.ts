import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'

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
