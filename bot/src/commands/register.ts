import { REST, Routes } from 'discord.js'
import { config } from '../config.js'
import { commands } from './definitions.js'

const rest = new REST().setToken(config.discord.token)

async function registerCommands(): Promise<void> {
  console.log(`正在註冊 ${commands.length} 個 slash command...`)

  await rest.put(
    Routes.applicationCommands(config.discord.clientId),
    { body: commands.map((c) => c.toJSON()) },
  )

  console.log('Slash command 註冊完成！')
}

registerCommands().catch((err) => {
  console.error('Slash command 註冊失敗:', err)
  process.exit(1)
})
