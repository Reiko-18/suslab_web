// supabase/functions/manage-tickets/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json()
    const { action } = body
    const sc = serviceClient()
    const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string

    if (action === 'list') {
      const isMod = role === 'moderator' || role === 'admin'
      let query = supabaseClient
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      // Members only see their own tickets
      if (!isMod) {
        query = query.eq('created_by', user.id)
      }

      // Optional status filter
      if (body.status) {
        query = query.eq('status', body.status)
      }

      const page = body.page ?? 1
      const pageSize = body.pageSize ?? 20
      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)

      // Enrich with author info
      const userIds = [...new Set((data ?? []).map((t: { created_by: string }) => t.created_by))]
      const { data: users } = await sc.auth.admin.listUsers()
      const userMap = new Map(
        (users?.users ?? []).map((u: { id: string; user_metadata?: Record<string, unknown>; email?: string }) => [
          u.id,
          {
            display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
            avatar_url: u.user_metadata?.avatar_url as string | null,
          },
        ])
      )

      const enriched = (data ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        author_name: (userMap.get(t.created_by as string) as { display_name: string } | undefined)?.display_name ?? 'Unknown',
        author_avatar: (userMap.get(t.created_by as string) as { avatar_url: string | null } | undefined)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    if (action === 'create') {
      const { title, content, category, priority } = body
      if (!title || !content) return errorResponse('Missing title or content', 400)

      const { data, error } = await supabaseClient
        .from('tickets')
        .insert({
          title,
          content,
          category: category ?? 'general',
          priority: priority ?? 'normal',
          source: 'web',
          created_by: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Audit log
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_create',
        target_type: 'ticket',
        target_id: data.id,
        target_name: title,
        details: { category, priority },
      })

      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const isMod = role === 'moderator' || role === 'admin'
      if (!isMod) return errorResponse('Only moderator+ can update tickets', 403)

      const { id, status, priority, assigned_to } = body
      if (!id) return errorResponse('Missing ticket id', 400)

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status !== undefined) updates.status = status
      if (priority !== undefined) updates.priority = priority
      if (assigned_to !== undefined) updates.assigned_to = assigned_to

      const { data, error } = await supabaseClient
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_update',
        target_type: 'ticket',
        target_id: id,
        target_name: data.title,
        details: updates,
      })

      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') return errorResponse('Only admin can delete tickets', 403)

      const { id } = body
      if (!id) return errorResponse('Missing ticket id', 400)

      const { data: existing } = await supabaseClient
        .from('tickets')
        .select('title')
        .eq('id', id)
        .single()

      const { error } = await supabaseClient
        .from('tickets')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)

      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'ticket_delete',
        target_type: 'ticket',
        target_id: id,
        target_name: existing?.title ?? 'Unknown',
        details: {},
      })

      return jsonResponse({ success: true })
    }

    if (action === 'reply') {
      const { ticket_id, content } = body
      if (!ticket_id || !content) return errorResponse('Missing ticket_id or content', 400)

      const { data, error } = await supabaseClient
        .from('ticket_replies')
        .insert({
          ticket_id,
          content,
          author_id: user.id,
        })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ ...data, author_name: actorName })
    }

    if (action === 'replies') {
      const { ticket_id } = body
      if (!ticket_id) return errorResponse('Missing ticket_id', 400)

      const { data, error } = await supabaseClient
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true })

      if (error) return errorResponse(error.message, 500)

      // Enrich with author info
      const { data: users } = await sc.auth.admin.listUsers()
      const userMap = new Map(
        (users?.users ?? []).map((u: { id: string; user_metadata?: Record<string, unknown>; email?: string }) => [
          u.id,
          {
            display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.email) as string,
            avatar_url: u.user_metadata?.avatar_url as string | null,
          },
        ])
      )

      const enriched = (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        author_name: (userMap.get(r.author_id as string) as { display_name: string } | undefined)?.display_name ?? 'Unknown',
        author_avatar: (userMap.get(r.author_id as string) as { avatar_url: string | null } | undefined)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    return errorResponse('Invalid action. Use: list, create, update, delete, reply, replies', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
