import http from 'node:http'
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { config } from './config.js'
import { fullSync } from './services/guildSync.js'
import { registerGuildMemberAdd } from './listeners/guildMemberAdd.js'
import { registerGuildMemberRemove } from './listeners/guildMemberRemove.js'
import { registerCommandHandler } from './commands/handler.js'
import { registerMessageCreate } from './listeners/messageCreate.js'
import { startActionQueueWorker } from './workers/actionQueue.js'
import { registerCommands } from './commands/register.js'

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
  await registerCommands().catch(err => console.error('Slash command 自動註冊失敗:', err))
  await fullSync(client).catch(err => console.error('Guild 同步失敗:', err))
  startActionQueueWorker(client)
  console.log('All systems operational')
})

// Discord client 錯誤處理 — 防止未捕獲的錯誤導致 process 崩潰
client.on(Events.Error, (err) => {
  console.error('Discord client error:', err)
})

// 全域未捕獲錯誤處理
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

// Health check HTTP server (keeps Render free Web Service alive)
const PORT = parseInt(process.env.PORT ?? '3001', 10)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL ?? ''

const server = http.createServer((_req, res) => {
  const isReady = client.isReady()
  res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    status: isReady ? 'ok' : 'starting',
    uptime: process.uptime(),
    guilds: client.guilds?.cache.size ?? 0,
  }))
})

server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`)

  // Self-ping every 14 minutes to prevent Render free tier from sleeping
  if (RENDER_URL) {
    const INTERVAL = 14 * 60 * 1000
    setInterval(() => {
      fetch(RENDER_URL).catch(() => {})
    }, INTERVAL)
    console.log(`Self-ping enabled: ${RENDER_URL} every 14 minutes`)
  }
})

client.login(config.discord.token)
