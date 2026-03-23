import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await verifyAuth(req, 'member')

    // Service client for counting across tables
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const [membersResult, eventsResult, announcementsResult] = await Promise.all([
      serviceClient
        .from('user_roles')
        .select('*', { count: 'exact', head: true }),
      serviceClient
        .from('events')
        .select('*', { count: 'exact', head: true }),
      serviceClient
        .from('announcements')
        .select('*', { count: 'exact', head: true }),
    ])

    return jsonResponse({
      memberCount: membersResult.count ?? 0,
      eventCount: eventsResult.count ?? 0,
      announcementCount: announcementsResult.count ?? 0,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
