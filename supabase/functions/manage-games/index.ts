import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

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

    if (action === 'list-invites') {
      const { page = 1, pageSize = 20 } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      const { data: invites, error, count } = await supabaseClient
        .from('game_invites')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (error) return errorResponse(error.message, 500)

      // Get participant counts and host info
      const inviteIds = (invites ?? []).map((i: Record<string, unknown>) => i.id as string)
      const hostIds = [...new Set((invites ?? []).map((i: Record<string, unknown>) => i.host_id as string))]

      // Participants
      let participantCounts = new Map<string, number>()
      let participantUsers = new Map<string, string[]>()
      if (inviteIds.length > 0) {
        const { data: participants } = await supabaseClient
          .from('game_invite_participants')
          .select('invite_id, user_id')
          .in('invite_id', inviteIds)

        if (participants) {
          for (const p of participants) {
            const current = participantCounts.get(p.invite_id) ?? 0
            participantCounts.set(p.invite_id, current + 1)
            const users = participantUsers.get(p.invite_id) ?? []
            users.push(p.user_id)
            participantUsers.set(p.invite_id, users)
          }
        }
      }

      // Host display names
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (hostIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (hostIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (invites ?? []).map((i: Record<string, unknown>) => ({
        ...i,
        host_display_name: userMap.get(i.host_id as string)?.display_name ?? 'User',
        host_avatar_url: userMap.get(i.host_id as string)?.avatar_url ?? null,
        participant_count: participantCounts.get(i.id as string) ?? 0,
        is_participant: (participantUsers.get(i.id as string) ?? []).includes(user.id),
      }))

      return jsonResponse({ invites: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create-invite') {
      const { game_type, title, description, max_players = 4 } = body

      if (!game_type || typeof game_type !== 'string') {
        return errorResponse('game_type is required', 400)
      }
      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 100) {
        return errorResponse('Title must be between 1 and 100 characters', 400)
      }
      if (description && (typeof description !== 'string' || description.length > 500)) {
        return errorResponse('Description must be 500 characters or less', 400)
      }
      if (typeof max_players !== 'number' || max_players < 1) {
        return errorResponse('max_players must be a positive number', 400)
      }

      const { data, error } = await supabaseClient
        .from('game_invites')
        .insert({
          host_id: user.id,
          game_type,
          title,
          description: description ?? null,
          max_players,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'join-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // Check invite exists, is open, and not full
      const { data: invite, error: fetchError } = await supabaseClient
        .from('game_invites')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !invite) return errorResponse('Invite not found', 404)
      if (invite.status !== 'open') return errorResponse('Invite is not open', 400)

      // Check participant count
      const { count } = await supabaseClient
        .from('game_invite_participants')
        .select('*', { count: 'exact', head: true })
        .eq('invite_id', id)

      if ((count ?? 0) >= invite.max_players) {
        return errorResponse('Invite is full', 400)
      }

      const { data, error } = await supabaseClient
        .from('game_invite_participants')
        .insert({ invite_id: id, user_id: user.id })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') return errorResponse('Already joined this invite', 400)
        return errorResponse(error.message, 500)
      }
      return jsonResponse(data, 201)
    }

    if (action === 'leave-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // RLS ensures only own participation can be deleted
      const { error } = await supabaseClient
        .from('game_invite_participants')
        .delete()
        .eq('invite_id', id)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'close-invite') {
      const { id } = body
      if (!id) return errorResponse('Missing invite id', 400)

      // RLS ensures only host can update
      const { data, error } = await supabaseClient
        .from('game_invites')
        .update({ status: 'closed' })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'submit-score') {
      const { score } = body
      if (typeof score !== 'number' || score < 0) {
        return errorResponse('Score must be a non-negative number', 400)
      }

      // Check if user already has a higher score
      const { data: existing } = await supabaseClient
        .from('game_scores')
        .select('score')
        .eq('user_id', user.id)
        .eq('game_type', '2048')
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing && existing.score >= score) {
        return jsonResponse({ saved: false, message: 'Score not higher than existing best', best: existing.score })
      }

      const { data, error } = await supabaseClient
        .from('game_scores')
        .insert({ user_id: user.id, game_type: '2048', score })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ saved: true, score: data.score })
    }

    if (action === 'leaderboard') {
      // Top 20 scores for 2048 — best per user
      // We get all scores and deduplicate by user (highest)
      const { data: scores, error } = await supabaseClient
        .from('game_scores')
        .select('user_id, score')
        .eq('game_type', '2048')
        .order('score', { ascending: false })
        .limit(200)

      if (error) return errorResponse(error.message, 500)

      // Deduplicate: keep only best score per user
      const bestScores = new Map<string, number>()
      for (const s of (scores ?? [])) {
        if (!bestScores.has(s.user_id) || s.score > (bestScores.get(s.user_id) ?? 0)) {
          bestScores.set(s.user_id, s.score)
        }
      }

      // Sort and take top 20
      const sorted = [...bestScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)

      // Get user display names
      const userIds = sorted.map(([id]) => id)
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (userIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const leaderboard = sorted.map(([userId, score], index) => ({
        rank: index + 1,
        user_id: userId,
        display_name: userMap.get(userId)?.display_name ?? 'User',
        avatar_url: userMap.get(userId)?.avatar_url ?? null,
        score,
      }))

      return jsonResponse(leaderboard)
    }

    return errorResponse('Invalid action. Use: list-invites, create-invite, join-invite, leave-invite, close-invite, submit-score, leaderboard', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
