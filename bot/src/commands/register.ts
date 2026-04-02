import { REST, Routes } from 'discord.js'
import { config } from '../config.js'
import { commands } from './definitions.js'

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.discord.token)
  console.log(`正在註冊 ${commands.length} 個 slash command...`)

  await rest.put(
    Routes.applicationCommands(config.discord.clientId),
    { body: commands.map((c) => c.toJSON()) },
  )

  console.log('Slash command 註冊完成！')
}

// 直接執行時（npm run register）自動註冊
const isDirectRun = process.argv[1]?.includes('register')
if (isDirectRun) {
  registerCommands().catch((err) => {
    console.error('Slash command 註冊失敗:', err)
    process.exit(1)
  })
}
