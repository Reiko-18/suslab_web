import { createClient } from 'npm:@supabase/supabase-js@2'

type SupabaseClient = ReturnType<typeof createClient>

export interface DiscordApiErrorShape {
  message?: string
  code?: number
}

export interface DiscordGuildSummary {
  id: string
  name: string
  icon: string | null
  owner?: boolean
  permissions?: string
}

export interface DiscordUserProfile {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
  locale?: string | null
  public_flags?: number
  premium_type?: number
}

export interface DiscordGuildMember {
  user?: {
    id: string
    username?: string
    global_name?: string | null
    avatar?: string | null
  }
  nick?: string | null
  avatar?: string | null
  roles?: string[]
  joined_at?: string
  communication_disabled_until?: string | null
}

function getDiscordBaseUrl(): string {
  return Deno.env.get('DISCORD_API_BASE_URL') ?? 'https://discord.com/api/v10'
}

function getDiscordBotToken(): string {
  const token = Deno.env.get('DISCORD_BOT_TOKEN')
  if (!token) {
    throw new Error('Missing DISCORD_BOT_TOKEN')
  }
  return token
}

export async function discordRequest<T>(
  path: string,
  init: RequestInit = {},
  auth:
    | { type: 'bot' }
    | { type: 'bearer'; token: string } = { type: 'bot' },
): Promise<T> {
  const url = `${getDiscordBaseUrl()}${path}`
  const token = auth.type === 'bot' ? getDiscordBotToken() : auth.token
  const authorization = auth.type === 'bot' ? `Bot ${token}` : `Bearer ${token}`

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    let errorBody: DiscordApiErrorShape | null = null
    try {
      errorBody = await response.json()
    } catch {
      errorBody = null
    }
    throw new Error(errorBody?.message ?? `Discord API request failed (${response.status})`)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}

export async function getDiscordUserProfile(providerToken: string): Promise<DiscordUserProfile> {
  return discordRequest<DiscordUserProfile>('/users/@me', {}, { type: 'bearer', token: providerToken })
}

export async function listDiscordUserGuilds(providerToken: string): Promise<DiscordGuildSummary[]> {
  return discordRequest<DiscordGuildSummary[]>('/users/@me/guilds', {}, { type: 'bearer', token: providerToken })
}

export async function getDiscordGuildMember(guildId: string, discordUserId: string): Promise<DiscordGuildMember> {
  return discordRequest<DiscordGuildMember>(`/guilds/${guildId}/members/${discordUserId}`)
}

export async function createDiscordRole(guildId: string, payload: Record<string, unknown>) {
  return discordRequest(`/guilds/${guildId}/roles`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDiscordRole(guildId: string, roleId: string, payload: Record<string, unknown>) {
  return discordRequest(`/guilds/${guildId}/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDiscordRole(guildId: string, roleId: string) {
  return discordRequest<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' })
}

export async function addDiscordMemberRole(guildId: string, discordUserId: string, roleId: string) {
  return discordRequest<void>(`/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, { method: 'PUT' })
}

export async function removeDiscordMemberRole(guildId: string, discordUserId: string, roleId: string) {
  return discordRequest<void>(`/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, { method: 'DELETE' })
}

export async function kickDiscordMember(guildId: string, discordUserId: string) {
  return discordRequest<void>(`/guilds/${guildId}/members/${discordUserId}`, { method: 'DELETE' })
}

export async function banDiscordMember(guildId: string, discordUserId: string, reason?: string) {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  return discordRequest<void>(`/guilds/${guildId}/bans/${discordUserId}${query}`, {
    method: 'PUT',
  })
}

export async function unbanDiscordMember(guildId: string, discordUserId: string) {
  return discordRequest<void>(`/guilds/${guildId}/bans/${discordUserId}`, { method: 'DELETE' })
}

export async function timeoutDiscordMember(guildId: string, discordUserId: string, untilIso: string) {
  return discordRequest<void>(`/guilds/${guildId}/members/${discordUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      communication_disabled_until: untilIso,
    }),
  })
}

export async function upsertDiscordGuildsForUser(
  serviceClient: SupabaseClient,
  userId: string,
  discordUserId: string,
  guilds: DiscordGuildSummary[],
) {
  if (!guilds.length) return

  const guildRows = guilds.map((guild) => ({
    guild_id: guild.id,
    name: guild.name,
    icon: guild.icon,
    owner_discord_user_id: guild.owner ? discordUserId : null,
    synced_at: new Date().toISOString(),
    settings: {},
  }))

  const { error: guildError } = await serviceClient
    .from('discord_guilds')
    .upsert(guildRows, { onConflict: 'guild_id' })

  if (guildError) throw guildError

  const membershipRows = guilds.map((guild) => ({
    guild_id: guild.id,
    user_id: userId,
    discord_user_id: discordUserId,
    display_name: guild.name,
    permissions: guild.permissions ?? null,
    is_owner: guild.owner === true,
    updated_at: new Date().toISOString(),
  }))

  const { error: membershipError } = await serviceClient
    .from('discord_guild_memberships')
    .upsert(membershipRows, { onConflict: 'guild_id,user_id' })

  if (membershipError) throw membershipError
}

export async function syncDiscordMembershipDetails(
  serviceClient: SupabaseClient,
  userId: string,
  discordUserId: string,
  guildIds: string[],
) {
  if (!guildIds.length) return

  const membershipRows = []
  for (const guildId of guildIds) {
    try {
      const member = await getDiscordGuildMember(guildId, discordUserId)
      membershipRows.push({
        guild_id: guildId,
        user_id: userId,
        discord_user_id: discordUserId,
        display_name: member.nick ?? member.user?.global_name ?? member.user?.username ?? null,
        guild_avatar: member.avatar ?? null,
        role_ids: member.roles ?? [],
        joined_at: member.joined_at ?? null,
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Ignore guilds where the bot cannot inspect the user yet.
    }
  }

  if (!membershipRows.length) return

  const { error } = await serviceClient
    .from('discord_guild_memberships')
    .upsert(membershipRows, { onConflict: 'guild_id,user_id' })

  if (error) throw error
}
