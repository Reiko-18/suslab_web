import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, role, supabaseClient } = await verifyAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'get') {
      // Get member_profiles row
      const { data: profile, error: profileError } = await supabaseClient
        .from('member_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileError) return errorResponse(profileError.message, 500)

      // Get role info
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role, created_at, updated_at')
        .eq('user_id', user.id)
        .single()

      return jsonResponse({
        id: user.id,
        email: user.email,
        display_name: (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? user.user_metadata?.name ?? 'User') as string,
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        role: roleData?.role ?? role,
        created_at: user.created_at ?? null,
        role_since: roleData?.updated_at ?? null,
        bio: profile.bio,
        skill_tags: profile.skill_tags,
        social_links: profile.social_links,
        visibility: profile.visibility,
      })
    }

    if (action === 'update') {
      const { bio, skill_tags, social_links, visibility } = body
      const updates: Record<string, unknown> = {}

      // Validate bio
      if (bio !== undefined) {
        if (typeof bio !== 'string' || bio.length > 500) {
          return errorResponse('Bio must be a string with max 500 characters', 400)
        }
        updates.bio = bio
      }

      // Validate skill_tags
      if (skill_tags !== undefined) {
        if (!Array.isArray(skill_tags) || skill_tags.length > 10) {
          return errorResponse('skill_tags must be an array with max 10 items', 400)
        }
        for (const tag of skill_tags) {
          if (typeof tag !== 'string' || tag.length > 50) {
            return errorResponse('Each skill tag must be a string with max 50 characters', 400)
          }
        }
        updates.skill_tags = skill_tags
      }

      // Validate social_links
      if (social_links !== undefined) {
        if (typeof social_links !== 'object' || social_links === null || Array.isArray(social_links)) {
          return errorResponse('social_links must be an object', 400)
        }
        const allowedKeys = ['twitter', 'github', 'pixiv', 'youtube', 'other']
        for (const [key, val] of Object.entries(social_links)) {
          if (!allowedKeys.includes(key)) {
            return errorResponse(`Invalid social_links key: ${key}`, 400)
          }
          if (typeof val !== 'string' || (val as string).length > 200) {
            return errorResponse(`social_links.${key} must be a string with max 200 characters`, 400)
          }
        }
        updates.social_links = social_links
      }

      // Validate visibility
      if (visibility !== undefined) {
        if (typeof visibility !== 'object' || visibility === null || Array.isArray(visibility)) {
          return errorResponse('visibility must be an object', 400)
        }
        const allowedVisKeys = ['bio', 'email', 'skill_tags', 'social_links', 'avatar', 'role', 'join_date']
        for (const [key, val] of Object.entries(visibility)) {
          if (!allowedVisKeys.includes(key)) {
            return errorResponse(`Invalid visibility key: ${key}`, 400)
          }
          if (typeof val !== 'boolean') {
            return errorResponse(`visibility.${key} must be a boolean`, 400)
          }
        }
        updates.visibility = visibility
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse('No valid fields to update', 400)
      }

      const { data, error } = await supabaseClient
        .from('member_profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    return errorResponse('Invalid action. Use: get, update', 400)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500)
  }
})
