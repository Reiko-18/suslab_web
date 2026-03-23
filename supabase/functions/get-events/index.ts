import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, supabaseClient } = await verifyAuth(req, 'member')

    const { data: events, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('date', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    // Get registration data for all events
    const eventIds = (events ?? []).map((e: Record<string, unknown>) => e.id as string)

    let registrationCounts = new Map<string, number>()
    let userRegistrations = new Set<string>()

    if (eventIds.length > 0) {
      // Get all registrations for these events
      const { data: registrations } = await supabaseClient
        .from('event_registrations')
        .select('event_id, user_id')
        .in('event_id', eventIds)

      if (registrations) {
        for (const r of registrations) {
          const current = registrationCounts.get(r.event_id) ?? 0
          registrationCounts.set(r.event_id, current + 1)
          if (r.user_id === user.id) {
            userRegistrations.add(r.event_id)
          }
        }
      }
    }

    const enriched = (events ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      registration_count: registrationCounts.get(e.id as string) ?? 0,
      registered: userRegistrations.has(e.id as string),
    }))

    return jsonResponse(enriched)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
