import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient, role } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { title, description, date, time, location, attendees } = body
      const { data, error } = await supabaseClient
        .from('events')
        .insert({ title, description, date, time, location, attendees: attendees ?? 0 })
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    if (action === 'update') {
      const { id, ...updates } = body
      delete updates.action
      if (!id) return errorResponse('Missing event id', 400)

      const { data, error } = await supabaseClient
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'delete') {
      if (role !== 'admin') {
        return errorResponse('只有 Admin 可以刪除活動', 403)
      }

      const { id } = body
      if (!id) return errorResponse('Missing event id', 400)

      const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id)

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action. Use: create, update, delete', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
