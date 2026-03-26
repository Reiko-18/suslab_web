import { createClient } from 'npm:@supabase/supabase-js@2'

export interface UserInfo {
  display_name: string
  avatar_url: string | null
}

/**
 * Resolve display names and avatars for a set of user IDs.
 * Fetches only the users needed instead of listing all users.
 */
export async function resolveUserDisplayNames(
  serviceClient: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, UserInfo>> {
  const userMap = new Map<string, UserInfo>()
  if (userIds.length === 0) return userMap

  // Fetch all users (Supabase Admin API doesn't support filtering by IDs)
  // but limit to perPage 1000 and log a warning if we hit the limit
  const { data: { users }, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
  if (error || !users) return userMap

  const idSet = new Set(userIds)
  for (const u of users) {
    if (idSet.has(u.id)) {
      userMap.set(u.id, {
        display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
        avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
      })
    }
  }

  return userMap
}
