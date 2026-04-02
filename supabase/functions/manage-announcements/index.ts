import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyAuthWithServer, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { resolveUserDisplayNames } from '../_shared/users.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { action, server_id } = body

    let user: Awaited<ReturnType<typeof verifyAuth>>['user']
    let role: string
    let supabaseClient: Awaited<ReturnType<typeof verifyAuth>>['supabaseClient']

    if (server_id) {
      const auth = await verifyAuthWithServer(req, 'member', server_id)
      user = auth.user; role = auth.serverRole; supabaseClient = auth.supabaseClient
    } else {
      const auth = await verifyAuth(req, 'member')
      user = auth.user; role = auth.role; supabaseClient = auth.supabaseClient
    }

    if (action === 'list') {
      const { page = 1, pageSize = 20 } = body

      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      let query = supabaseClient
        .from('announcements')
        .select('*', { count: 'exact' })
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (server_id) {
        query = query.eq('server_id', server_id)
      }

      const { data: announcements, error: annError, count } = await query

      if (annError) return errorResponse(annError.message, 500)

      // Service client for author metadata
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const authorIds = [...new Set((announcements ?? []).map((a: { author_id: string }) => a.author_id))]
      const authorMap = await resolveUserDisplayNames(serviceClient, authorIds)

      const enriched = (announcements ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        author_display_name: authorMap.get(a.author_id as string)?.display_name ?? 'User',
        author_avatar_url: authorMap.get(a.author_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse({
        announcements: enriched,
        total: count ?? 0,
        page: clampedPage,
        pageSize: clampedPageSize,
      })
    }

    if (action === 'create') {
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { title, content, pinned = false } = body

      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }
      if (!content || typeof content !== 'string' || content.length < 1 || content.length > 5000) {
        return errorResponse('Content must be between 1 and 5000 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('announcements')
        .insert({
          title,
          content,
          author_id: user.id,
          source: 'web',
          pinned: !!pinned,
          server_id: server_id ?? null,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, title, content, pinned } = body

      if (!id) return errorResponse('Missing announcement id', 400)

      const updates: Record<string, unknown> = {}
      if (title !== undefined) {
        if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
          return errorResponse('Title must be between 1 and 200 characters', 400)
        }
        updates.title = title
      }
      if (content !== undefined) {
        if (typeof content !== 'string' || content.length < 1 || content.length > 5000) {
          return errorResponse('Content must be between 1 and 5000 characters', 400)
        }
        updates.content = content
      }
      if (pinned !== undefined) {
        updates.pinned = !!pinned
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      let updateQuery = supabaseClient
        .from('announcements')
        .update(updates)
        .eq('id', id)

      if (server_id) {
        updateQuery = updateQuery.eq('server_id', server_id)
      }

      const { data, error } = await updateQuery.select().single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') {
        return errorResponse('Admin role required', 403)
      }

      const { id } = body

      if (!id) return errorResponse('Missing announcement id', 400)

      let deleteQuery = supabaseClient
        .from('announcements')
        .delete()
        .eq('id', id)

      if (server_id) {
        deleteQuery = deleteQuery.eq('server_id', server_id)
      }

      const { error } = await deleteQuery

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: list, create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
