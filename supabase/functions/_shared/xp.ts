import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Atomically add XP to a user and recalculate their level.
 * Calls the `add_xp_atomic` Postgres function (defined in 010_user_levels.sql).
 * Uses a single atomic UPDATE — no SELECT then UPDATE.
 * Must be called with a service-role client (bypasses RLS).
 */
export async function addXp(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
): Promise<{ xp: number; level: number } | null> {
  const { data, error } = await serviceClient.rpc('add_xp_atomic', {
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) {
    console.error('addXp error:', error.message)
    return null
  }

  return data
}
