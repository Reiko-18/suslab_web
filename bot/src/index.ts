import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  console.log(`Serving ${c.guilds.cache.size} guilds`)
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
