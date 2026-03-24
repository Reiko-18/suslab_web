// supabase/functions/admin-settings/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'moderator')
    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .order('key')

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'get') {
      const { key } = body
      if (!key) return errorResponse('Missing key', 400)

      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .eq('key', key)
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (action === 'update') {
      if (role !== 'admin') return errorResponse('Only admin can update settings', 403)

      const { key, value } = body
      if (!key || value === undefined) return errorResponse('Missing key or value', 400)

      const { data, error } = await supabaseClient
        .from('system_settings')
        .update({
          value: JSON.parse(JSON.stringify(value)),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)

      // Audit log
      const sc = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      const actorName = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'Unknown') as string
      await sc.from('admin_audit_logs').insert({
        actor_id: user.id,
        actor_name: actorName,
        action: 'setting_update',
        target_type: 'setting',
        target_id: key,
        target_name: key,
        details: { value },
      })

      return jsonResponse(data)
    }

    if (action === 'batch-update') {
      if (role !== 'admin') return errorResponse('Only admin can update settings', 403)

      const { settings } = body
      if (!settings || !Array.isArray(settings)) return errorResponse('Missing settings array', 400)

      const results = []
      for (const { key, value } of settings) {
        const { data, error } = await supabaseClient
          .from('system_settings')
          .update({
            value: JSON.parse(JSON.stringify(value)),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .select()
          .single()

        if (error) return errorResponse(`Failed to update ${key}: ${error.message}`, 500)
        results.push(data)
      }

      return jsonResponse(results)
    }

    return errorResponse('Invalid action. Use: list, get, update, batch-update', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
