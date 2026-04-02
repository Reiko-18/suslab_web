import http from 'node:http'
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { initI18n } from './i18n/index.js'
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'
import { registerCommandHandler } from './commands/handler.js'
import { registerMessageCreate } from './listeners/messageCreate.js'
import { startActionQueueWorker } from './workers/actionQueue.js'
import { registerCommands } from './commands/register.js'

// Health check HTTP server — 必須最先啟動，Render 需要在啟動時偵測到開放的 port
const PORT = parseInt(process.env.PORT ?? '3001', 10)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL ?? ''
let botReady = false

const server = http.createServer((_req, res) => {
  res.writeHead(botReady ? 200 : 503, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    status: botReady ? 'ok' : 'starting',
    uptime: process.uptime(),
  }))
})

server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`)

  if (RENDER_URL) {
    const INTERVAL = 14 * 60 * 1000
    setInterval(() => {
      fetch(RENDER_URL).catch(() => {})
    }, INTERVAL)
    console.log(`Self-ping enabled: ${RENDER_URL} every 14 minutes`)
  }
})

// 初始化 i18n
await initI18n()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

// 註冊事件監聽器
registerGuildMemberAdd(client)
registerGuildMemberRemove(client)
registerCommandHandler(client)
registerMessageCreate(client)

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}`)
  console.log(`Serving ${c.guilds.cache.size} guilds`)
  await registerCommands().catch(err => console.error('Slash command 自動註冊失敗:', err))
  await fullSync(client).catch(err => console.error('Guild 同步失敗:', err))
  startActionQueueWorker(client)
  botReady = true
  console.log('All systems operational')
})

// 錯誤處理
client.on(Events.Error, (err) => {
  console.error('Discord client error:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
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
