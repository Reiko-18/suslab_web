import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, verifyAuthWithServer, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { addXp } from '../_shared/xp.ts'
import { resolveUserDisplayNames } from '../_shared/users.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // CHANGED: lowered from 'moderator' to 'member' for registration actions
    const body = await req.json()
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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'create') {
      // Inline role check: moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { title, description, date, time, location, attendees } = body
      const { data, error } = await supabaseClient
        .from('events')
        .insert({ title, description, date, time, location, attendees: attendees ?? 0, server_id: server_id ?? null })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      // Inline role check: moderator+ only
      if (role !== 'moderator' && role !== 'admin') {
        return errorResponse('Moderator or admin role required', 403)
      }

      const { id, title, description, date, time, location, attendees } = body
      if (!id) return errorResponse('Missing event id', 400)

      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description = description
      if (date !== undefined) updates.date = date
      if (time !== undefined) updates.time = time
      if (location !== undefined) updates.location = location
      if (attendees !== undefined) updates.attendees = attendees

      let updateQuery = supabaseClient
        .from('events')
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
      // Inline role check: admin only (preserved from original)
      if (role !== 'admin') {
        return errorResponse('Only admin can delete events', 403)
      }

      const { id } = body
      if (!id) return errorResponse('Missing event id', 400)

      let deleteQuery = supabaseClient
        .from('events')
        .delete()
        .eq('id', id)

      if (server_id) {
        deleteQuery = deleteQuery.eq('server_id', server_id)
      }

      const { error } = await deleteQuery

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'register') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      const { data, error } = await supabaseClient
        .from('event_registrations')
        .insert({ event_id, user_id: user.id })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') return errorResponse('Already registered', 400)
        return errorResponse(error.message, 500)
      }

      // Award +10 XP for registering
      await addXp(serviceClient, user.id, 10)

      return jsonResponse(data, 201)
    }

    if (action === 'unregister') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      // RLS ensures only own registration can be deleted
      const { error } = await supabaseClient
        .from('event_registrations')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'registrations') {
      const { event_id } = body
      if (!event_id) return errorResponse('Missing event_id', 400)

      const { data: registrations, error } = await supabaseClient
        .from('event_registrations')
        .select('user_id, registered_at')
        .eq('event_id', event_id)
        .order('registered_at', { ascending: true })

      if (error) return errorResponse(error.message, 500)

      // Get display names + avatars
      const userIds = (registrations ?? []).map((r: Record<string, unknown>) => r.user_id as string)
      const userMap = await resolveUserDisplayNames(serviceClient, userIds)

      const enriched = (registrations ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        display_name: userMap.get(r.user_id as string)?.display_name ?? 'User',
        avatar_url: userMap.get(r.user_id as string)?.avatar_url ?? null,
      }))

      return jsonResponse(enriched)
    }

    return errorResponse('Invalid action. Use: create, update, delete, register, unregister, registrations', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
