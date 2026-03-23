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

  // Todos
  listTodos: ({ page, pageSize } = {}) =>
    invoke('manage-todos', { action: 'list', page, pageSize }),

  createTodo: ({ title, is_public }) =>
    invoke('manage-todos', { action: 'create', title, is_public }),

  updateTodo: (id, { title, completed } = {}) =>
    invoke('manage-todos', { action: 'update', id, title, completed }),

  deleteTodo: (id) =>
    invoke('manage-todos', { action: 'delete', id }),

  claimTodo: (id) =>
    invoke('manage-todos', { action: 'claim', id }),

  unclaimTodo: (id) =>
    invoke('manage-todos', { action: 'unclaim', id }),

  // Games
  listGameInvites: ({ page, pageSize } = {}) =>
    invoke('manage-games', { action: 'list-invites', page, pageSize }),

  createGameInvite: ({ game_type, title, description, max_players }) =>
    invoke('manage-games', { action: 'create-invite', game_type, title, description, max_players }),

  joinGameInvite: (id) =>
    invoke('manage-games', { action: 'join-invite', id }),

  leaveGameInvite: (id) =>
    invoke('manage-games', { action: 'leave-invite', id }),

  closeGameInvite: (id) =>
    invoke('manage-games', { action: 'close-invite', id }),

  submitGameScore: (score) =>
    invoke('manage-games', { action: 'submit-score', score }),

  getGameLeaderboard: () =>
    invoke('manage-games', { action: 'leaderboard' }),

  // Feedbacks
  listFeedbacks: ({ page, pageSize, category } = {}) =>
    invoke('manage-feedbacks', { action: 'list', page, pageSize, category }),

  createFeedback: ({ category, title, content }) =>
    invoke('manage-feedbacks', { action: 'create', category, title, content }),

  voteFeedback: (feedback_id) =>
    invoke('manage-feedbacks', { action: 'vote', feedback_id }),

  updateFeedbackStatus: (id, status) =>
    invoke('manage-feedbacks', { action: 'update-status', id, status }),

  deleteFeedback: (id) =>
    invoke('manage-feedbacks', { action: 'delete', id }),

  // Levels
  getMyLevel: () =>
    invoke('manage-levels', { action: 'get' }),

  getLevelLeaderboard: () =>
    invoke('manage-levels', { action: 'leaderboard' }),

  grantBadge: (user_id, badge) =>
    invoke('manage-levels', { action: 'grant-badge', user_id, badge }),

  // Event Registration
  registerEvent: (event_id) =>
    invoke('manage-events', { action: 'register', event_id }),

  unregisterEvent: (event_id) =>
    invoke('manage-events', { action: 'unregister', event_id }),

  getEventRegistrations: (event_id) =>
    invoke('manage-events', { action: 'registrations', event_id }),
}
