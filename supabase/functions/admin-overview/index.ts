// supabase/functions/admin-overview/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await verifyAuth(req, 'moderator')

    const sc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parallel queries
    const [ticketsRes, feedbackRes, usersRes, recentAuditRes, pendingActionsRes] = await Promise.all([
      supabaseClient.from('tickets').select('status', { count: 'exact', head: false }),
      supabaseClient.from('feedbacks').select('status', { count: 'exact', head: false }),
      sc.auth.admin.listUsers(),
      supabaseClient.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabaseClient.from('pending_bot_actions').select('*', { count: 'exact' }).eq('status', 'pending'),
    ])

    const tickets = ticketsRes.data ?? []
    const feedbacks = feedbackRes.data ?? []
    const openTickets = tickets.filter((t: { status: string }) => t.status === 'open' || t.status === 'in_progress').length
    const openFeedback = feedbacks.filter((f: { status: string }) => f.status === 'open').length

    return jsonResponse({
      total_users: usersRes.data?.users?.length ?? 0,
      total_tickets: tickets.length,
      open_tickets: openTickets,
      total_feedback: feedbacks.length,
      open_feedback: openFeedback,
      pending_bot_actions: pendingActionsRes.count ?? 0,
      recent_audit: recentAuditRes.data ?? [],
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
