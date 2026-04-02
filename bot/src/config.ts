import 'dotenv/config'

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN ?? '',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
} as const

for (const [key, value] of Object.entries(config.discord)) {
  if (!value) throw new Error(`Missing env var: DISCORD_${key.toUpperCase()}`)
}
for (const [key, value] of Object.entries(config.supabase)) {
  if (!value) throw new Error(`Missing env var: SUPABASE_${key.toUpperCase()}`)
}
