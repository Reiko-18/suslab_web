import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'
import { resolveUserDisplayNames } from '../_shared/users.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    // Service client for XP operations and user metadata
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'list') {
      const { page = 1, pageSize = 50 } = body
      const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
      const clampedPage = Math.max(1, page)
      const offset = (clampedPage - 1) * clampedPageSize

      // RLS handles visibility: own todos + public todos
      const { data: todos, error, count } = await supabaseClient
        .from('todos')
        .select('*', { count: 'exact' })
        .order('completed', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + clampedPageSize - 1)

      if (error) return errorResponse(error.message, 500)

      // Enrich with user display names
      const userIds = [...new Set(
        (todos ?? []).flatMap((t: Record<string, unknown>) =>
          [t.user_id, t.assigned_to].filter(Boolean) as string[]
        )
      )]

      const userMap = await resolveUserDisplayNames(serviceClient, userIds)

      const enriched = (todos ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        creator_display_name: userMap.get(t.user_id as string)?.display_name ?? 'User',
        creator_avatar_url: userMap.get(t.user_id as string)?.avatar_url ?? null,
        assignee_display_name: t.assigned_to ? (userMap.get(t.assigned_to as string)?.display_name ?? null) : null,
        assignee_avatar_url: t.assigned_to ? (userMap.get(t.assigned_to as string)?.avatar_url ?? null) : null,
      }))

      return jsonResponse({ todos: enriched, total: count ?? 0, page: clampedPage, pageSize: clampedPageSize })
    }

    if (action === 'create') {
      const { title, is_public = false } = body

      if (!title || typeof title !== 'string' || title.length < 1 || title.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }

      const { data, error } = await supabaseClient
        .from('todos')
        .insert({ user_id: user.id, title, is_public: !!is_public })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const { id, title, completed } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo first to determine permissions
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)

      // Build update object based on user role relative to this todo
      const updates: Record<string, unknown> = {}

      if (todo.user_id === user.id) {
        // Creator can update title and completed
        if (title !== undefined) {
          if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
            return errorResponse('Title must be between 1 and 200 characters', 400)
          }
          updates.title = title
        }
        if (completed !== undefined) updates.completed = !!completed
      } else if (todo.assigned_to === user.id) {
        // Assignee can ONLY change completed
        if (completed !== undefined) updates.completed = !!completed
        // Ignore any other fields — assignees cannot change title etc.
      } else {
        return errorResponse('Not authorized to update this todo', 403)
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      const { data, error } = await supabaseClient
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Award XP when completing a todo (only when transitioning to completed)
      if (completed === true && !todo.completed) {
        await addXp(serviceClient, user.id, 2)
      }

      return jsonResponse(data)
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // RLS ensures only creator can delete
      const { error } = await supabaseClient
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'claim') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo to check it's public and unclaimed
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)
      if (!todo.is_public) return errorResponse('Can only claim public todos', 400)
      if (todo.assigned_to) return errorResponse('Todo is already claimed', 400)

      // Use service client to update assigned_to (bypasses RLS check for this edge case)
      const { data, error } = await serviceClient
        .from('todos')
        .update({ assigned_to: user.id })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'unclaim') {
      const { id } = body
      if (!id) return errorResponse('Missing todo id', 400)

      // Fetch the todo to verify the current user is the assignee
      const { data: todo, error: fetchError } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !todo) return errorResponse('Todo not found', 404)
      if (todo.assigned_to !== user.id) return errorResponse('You are not the assignee', 403)

      const { data, error } = await serviceClient
        .from('todos')
        .update({ assigned_to: null })
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: list, create, update, delete, claim, unclaim', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
