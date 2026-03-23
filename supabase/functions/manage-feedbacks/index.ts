import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'

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

    if (action === 'list') {
      const { page = 1, pageSize = 20, category } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      let query = supabaseClient
        .from('feedbacks')
        .select('*', { count: 'exact' })
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (category && ['feature', 'event', 'bug'].includes(category)) {
        query = query.eq('category', category)
      }

      const { data: feedbacks, error, count } = await query

      if (error) return errorResponse(error.message, 500)

      // Check which feedbacks the current user has voted on
      const feedbackIds = (feedbacks ?? []).map((f: Record<string, unknown>) => f.id as string)
      let votedSet = new Set<string>()
      if (feedbackIds.length > 0) {
        const { data: votes } = await supabaseClient
          .from('feedback_votes')
          .select('feedback_id')
          .eq('user_id', user.id)
          .in('feedback_id', feedbackIds)

        if (votes) {
          votedSet = new Set(votes.map((v: { feedback_id: string }) => v.feedback_id))
        }
      }

      // Get author display names
      const authorIds = [...new Set((feedbacks ?? []).map((f: Record<string, unknown>) => f.author_id as string))]
      const userMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (authorIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (authorIds.includes(u.id)) {
              userMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (feedbacks ?? []).map((f: Record<string, unknown>) => ({
        ...f,
        has_voted: votedSet.has(f.id as string),
        author_display_name: userMap.get(f.author_id as string)?.display_name ?? 'User',
        author_avatar_url: userMap.get(f.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({ feedbacks: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create') {
      const { category, title, content } = body

      if (!category || !['feature', 'event', 'bug'].includes(category)) {
        return errorResponse('Category must be one of: feature, event, bug', 400)
      }
      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }
      if (!content || typeof content !== 'string' || content.length < 1 || content.length > 2000) {
        return errorResponse('Content must be between 1 and 2000 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('feedbacks')
        .insert({ author_id: user.id, category, title, content })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Award +5 XP for submitting feedback
      await addXp(serviceClient, user.id, 5)

      return jsonResponse(data, 201)
    }

    if (action === 'vote') {
      const { feedback_id } = body
      if (!feedback_id) return errorResponse('Missing feedback_id', 400)

      // Check if already voted
      const { data: existingVote } = await supabaseClient
        .from('feedback_votes')
        .select('feedback_id')
        .eq('feedback_id', feedback_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingVote) {
        // Remove vote
        const { error: deleteError } = await supabaseClient
          .from('feedback_votes')
          .delete()
          .eq('feedback_id', feedback_id)
          .eq('user_id', user.id)

        if (deleteError) return errorResponse(deleteError.message, 500)

        // Decrement vote_count using service client
        const { data: feedback } = await serviceClient
          .from('feedbacks')
          .select('vote_count')
          .eq('id', feedback_id)
          .single()

        if (feedback) {
          await serviceClient
            .from('feedbacks')
            .update({ vote_count: Math.max(0, feedback.vote_count - 1) })
            .eq('id', feedback_id)
        }

        return jsonResponse({ voted: false })
      } else {
        // Add vote
        const { error: insertError } = await supabaseClient
          .from('feedback_votes')
          .insert({ feedback_id, user_id: user.id })

        if (insertError) return errorResponse(insertError.message, 500)

        // Increment vote_count using service client
        const { data: feedback } = await serviceClient
          .from('feedbacks')
          .select('vote_count')
          .eq('id', feedback_id)
          .single()

        if (feedback) {
          await serviceClient
            .from('feedbacks')
            .update({ vote_count: feedback.vote_count + 1 })
            .eq('id', feedback_id)
        }

        return jsonResponse({ voted: true })
      }
    }

    if (action === 'update-status') {
      // Moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, status } = body
      if (!id) return errorResponse('Missing feedback id', 400)
      if (!status || !['open', 'reviewed', 'accepted', 'rejected'].includes(status)) {
        return errorResponse('Status must be one of: open, reviewed, accepted, rejected', 400)
      }

      // ONLY update the status field — never spread the request body
      const { data, error } = await supabaseClient
        .from('feedbacks')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return errorResponse('Missing feedback id', 400)

      // RLS handles: author or admin can delete
      const { error } = await supabaseClient
        .from('feedbacks')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, vote, update-status, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
