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

    if (action === 'list') {
      const { profile_user_id, page = 1, pageSize = 50 } = body

      if (!profile_user_id) {
        return errorResponse('Missing profile_user_id', 400)
      }

      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      // Get comments
      const { data: comments, error: commentsError, count } = await supabaseClient
        .from('profile_comments')
        .select('*', { count: 'exact' })
        .eq('profile_user_id', profile_user_id)
        .order('created_at', { ascending: true })
        .range(offset, offset + clampedPageSize - 1)

      if (commentsError) return errorResponse(commentsError.message, 500)

      // Service client for author metadata
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Get unique author IDs
      const authorIds = [...new Set((comments ?? []).map((c: { author_id: string }) => c.author_id))]

      // Get author metadata
      const authorMap = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (authorIds.length > 0) {
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
        if (!usersError && users) {
          for (const u of users) {
            if (authorIds.includes(u.id)) {
              authorMap.set(u.id, {
                display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
                avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
              })
            }
          }
        }
      }

      const enriched = (comments ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        author_display_name: authorMap.get(c.author_id as string)?.display_name ?? 'User',
        author_avatar_url: authorMap.get(c.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({
        comments: enriched,
        total: count ?? 0,
        page: clampedPage,
        pageSize: clampedPageSize,
      })
    }

    if (action === 'create') {
      const { profile_user_id, content } = body

      if (!profile_user_id) {
        return errorResponse('Missing profile_user_id', 400)
      }
      if (!content || typeof content !== 'string') {
        return errorResponse('Content is required', 400)
      }
      if (content.length < 1 || content.length > 500) {
        return errorResponse('Content must be between 1 and 500 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('profile_comments')
        .insert({
          profile_user_id,
          author_id: user.id,
          content,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'delete') {
      const { id } = body

      if (!id) {
        return errorResponse('Missing comment id', 400)
      }

      // Check if user is the profile owner or admin
      const { data: comment, error: fetchError } = await supabaseClient
        .from('profile_comments')
        .select('profile_user_id')
        .eq('id', id)
        .single()

      if (fetchError) return errorResponse('Comment not found', 404)

      if (comment.profile_user_id !== user.id && role !== 'admin') {
        return errorResponse('Only the profile owner or admin can delete comments', 403)
      }

      const { error } = await supabaseClient
        .from('profile_comments')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
