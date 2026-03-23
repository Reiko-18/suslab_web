import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { search, page = 1, pageSize = 50 } = body

    const clampedPageSize = Math.min(Math.max(1, pageSize), 100)
    const clampedPage = Math.max(1, page)
    const offset = (clampedPage - 1) * clampedPageSize

    // Service client for auth.users metadata
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get all auth users for metadata join
    const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return errorResponse(usersError.message, 500)

    const userMap = new Map(
      users.map((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string }) => [
        u.id,
        {
          email: u.email,
          display_name: (u.user_metadata?.full_name ?? u.user_metadata?.user_name ?? u.user_metadata?.name ?? u.email) as string,
          avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
          created_at: u.created_at,
        },
      ]),
    )

    // Get roles
    const { data: roles, error: rolesError } = await serviceClient
      .from('user_roles')
      .select('user_id, role')
    if (rolesError) return errorResponse(rolesError.message, 500)
    const roleMap = new Map(
      (roles ?? []).map((r: { user_id: string; role: string }) => [r.user_id, r.role]),
    )

    // Get member profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('member_profiles')
      .select('*')

    if (profilesError) return errorResponse(profilesError.message, 500)

    // Combine profiles with user metadata
    let members = (profiles ?? []).map((p: Record<string, unknown>) => {
      const userId = p.user_id as string
      const userMeta = userMap.get(userId)
      const visibility = (p.visibility ?? {}) as Record<string, boolean>
      const role = roleMap.get(userId) ?? 'member'

      const member: Record<string, unknown> = {
        user_id: userId,
        display_name: userMeta?.display_name ?? 'User',
        created_at: userMeta?.created_at ?? null,
        role,
      }

      // Apply visibility filtering
      if (visibility.avatar !== false) {
        member.avatar_url = userMeta?.avatar_url ?? null
      }
      if (visibility.bio !== false) {
        member.bio = p.bio
      }
      if (visibility.email !== false) {
        member.email = userMeta?.email ?? null
      }
      if (visibility.skill_tags !== false) {
        member.skill_tags = p.skill_tags
      }
      if (visibility.social_links !== false) {
        member.social_links = p.social_links
      }
      if (visibility.role === false) {
        member.role = undefined
      }
      if (visibility.join_date === false) {
        member.created_at = undefined
      }

      return member
    })

    // Search filter
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.trim().toLowerCase()
      members = members.filter(
        (m: Record<string, unknown>) =>
          ((m.display_name as string) ?? '').toLowerCase().includes(searchLower),
      )
    }

    // Sort by display name
    members.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.display_name as string) ?? '').localeCompare((b.display_name as string) ?? ''),
    )

    const total = members.length
    const paged = members.slice(offset, offset + clampedPageSize)

    return jsonResponse({
      members: paged,
      total,
      page: clampedPage,
      pageSize: clampedPageSize,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
