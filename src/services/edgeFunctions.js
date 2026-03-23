import { supabase } from './supabaseClient'

async function invoke(functionName, body = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    // Try to parse error response body for structured errors
    let parsed = null
    if (error.context?.body) {
      try {
        const text = await new Response(error.context.body).text()
        parsed = JSON.parse(text)
      } catch {
        // ignore parse errors
      }
    }

    const message = parsed?.error ?? error.message ?? 'Unknown error'
    const status = error.context?.status ?? 500
    throw { message, status }
  }

  return data
}

export const edgeFunctions = {
  // Events
  getEvents: () => invoke('get-events'),

  createEvent: (event) => invoke('manage-events', {
    action: 'create',
    ...event,
  }),

  updateEvent: (id, updates) => invoke('manage-events', {
    action: 'update',
    id,
    ...updates,
  }),

  deleteEvent: (id) => invoke('manage-events', {
    action: 'delete',
    id,
  }),

  // Profile (legacy — kept for backward compatibility)
  getProfile: () => invoke('get-profile'),

  // Profile (new — full profile with editing fields)
  getOwnProfile: () => invoke('manage-profile', { action: 'get' }),

  updateProfile: ({ bio, skill_tags, social_links, visibility }) =>
    invoke('manage-profile', {
      action: 'update',
      bio,
      skill_tags,
      social_links,
      visibility,
    }),

  // Members
  getMembers: ({ search, page, pageSize } = {}) =>
    invoke('get-members', { search, page, pageSize }),

  // Profile Comments
  listComments: (profile_user_id, { page, pageSize } = {}) =>
    invoke('profile-comments', {
      action: 'list',
      profile_user_id,
      page,
      pageSize,
    }),

  createComment: (profile_user_id, content) =>
    invoke('profile-comments', {
      action: 'create',
      profile_user_id,
      content,
    }),

  deleteComment: (id) =>
    invoke('profile-comments', {
      action: 'delete',
      id,
    }),

  // Announcements
  listAnnouncements: ({ page, pageSize } = {}) =>
    invoke('manage-announcements', {
      action: 'list',
      page,
      pageSize,
    }),

  createAnnouncement: ({ title, content, pinned }) =>
    invoke('manage-announcements', {
      action: 'create',
      title,
      content,
      pinned,
    }),

  updateAnnouncement: (id, { title, content, pinned }) =>
    invoke('manage-announcements', {
      action: 'update',
      id,
      title,
      content,
      pinned,
    }),

  deleteAnnouncement: (id) =>
    invoke('manage-announcements', {
      action: 'delete',
      id,
    }),

  // Stats
  getStats: () => invoke('get-stats'),

  // Admin
  getUsers: () => invoke('manage-users', { action: 'list' }),

  updateUserRole: (userId, role) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
  }),
}
