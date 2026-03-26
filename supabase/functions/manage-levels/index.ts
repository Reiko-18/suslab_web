import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { resolveUserDisplayNames } from '../_shared/users.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'get') {
      const { data, error } = await supabaseClient
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'leaderboard') {
      const { data: levels, error } = await supabaseClient
        .from('user_levels')
        .select('user_id, xp, level, badges')
        .order('xp', { ascending: false })
        .limit(20)

      if (error) return errorResponse(error.message, 500)

      // Get user display names
      const userIds = (levels ?? []).map((l: Record<string, unknown>) => l.user_id as string)
      const userMap = await resolveUserDisplayNames(serviceClient, userIds)

      const leaderboard = (levels ?? []).map((l: Record<string, unknown>, index: number) => ({
        rank: index + 1,
        user_id: l.user_id,
        display_name: userMap.get(l.user_id as string)?.display_name ?? 'User',
        avatar_url: userMap.get(l.user_id as string)?.avatar_url ?? null,
        xp: l.xp,
        level: l.level,
        badges: l.badges,
      }))

      return jsonResponse(leaderboard)
    }

    if (action === 'grant-badge') {
      if (role !== 'admin') {
        return errorResponse('Admin role required', 403)
      }

      const { user_id: targetUserId, badge } = body
      if (!targetUserId) return errorResponse('Missing user_id', 400)
      if (!badge || typeof badge !== 'string') return errorResponse('Missing badge', 400)

      // Fetch current badges
      const { data: currentLevel, error: fetchError } = await serviceClient
        .from('user_levels')
        .select('badges')
        .eq('user_id', targetUserId)
        .single()

      if (fetchError || !currentLevel) return errorResponse('User not found', 404)

      const currentBadges: string[] = currentLevel.badges ?? []
      if (currentBadges.includes(badge)) {
        return errorResponse('User already has this badge', 400)
      }

      const { data, error } = await serviceClient
        .from('user_levels')
        .update({ badges: [...currentBadges, badge] })
        .eq('user_id', targetUserId)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: get, leaderboard, grant-badge', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
