import { supabase } from './supabaseClient'

interface InvokeError extends Error {
  status: number
}

async function invoke<T = unknown>(functionName: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    let parsed: { error?: string } | null = null
    if ((error as { context?: { body?: unknown } }).context?.body) {
      try {
        const text = await new Response((error as { context: { body: BodyInit } }).context.body).text()
        parsed = JSON.parse(text)
      } catch {
        // ignore parse errors
      }
    }

    const message = parsed?.error ?? error.message ?? 'Unknown error'
    const status = (error as { context?: { status?: number } }).context?.status ?? 500
    throw Object.assign(new Error(message), { status }) as InvokeError
  }

  return data as T
}

// --- Param interfaces ---

export interface EventParams {
  title?: string
  description?: string
  start_at?: string
  end_at?: string
  location?: string
  max_participants?: number
  server_id?: string
}

export interface ProfileUpdateParams {
  bio?: string
  skill_tags?: string[]
  social_links?: Record<string, string>
  visibility?: string
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface MembersParams extends PaginationParams {
  search?: string
  server_id?: string
}

export interface AnnouncementParams {
  title: string
  content: string
  pinned?: boolean
  server_id?: string
}

export interface AuditLogParams extends PaginationParams {
  actionFilter?: string
  targetType?: string
  server_id?: string
}

export interface RoleParams {
  name: string
  color?: string
  permissions?: string[]
  position?: number
  server_id?: string
}

export interface TicketParams extends PaginationParams {
  status?: string
  server_id?: string
}

export interface TicketCreateParams {
  title: string
  content: string
  category?: string
  priority?: string
  server_id?: string
}

export interface TicketUpdateParams {
  status?: string
  priority?: string
  assigned_to?: string
}

export interface TodoCreateParams {
  title: string
  is_public?: boolean
  server_id?: string
}

export interface TodoUpdateParams {
  title?: string
  completed?: boolean
}

export interface GameInviteParams {
  game_type: string
  title: string
  description?: string
  max_players?: number
  server_id?: string
}

export interface FeedbackParams extends PaginationParams {
  category?: string
  server_id?: string
}

export interface FeedbackCreateParams {
  category: string
  title: string
  content: string
  server_id?: string
}

export const edgeFunctions = {
  // Events
  getEvents: (server_id?: string) => invoke('get-events', { server_id }),

  createEvent: ({ server_id, ...event }: EventParams) => invoke('manage-events', {
    action: 'create',
    ...event,
    server_id,
  }),

  updateEvent: (id: string, { server_id, ...updates }: EventParams) => invoke('manage-events', {
    action: 'update',
    id,
    ...updates,
    server_id,
  }),

  deleteEvent: (id: string, server_id?: string) => invoke('manage-events', {
    action: 'delete',
    id,
    server_id,
  }),

  // Profile (legacy — kept for backward compatibility)
  getProfile: () => invoke('get-profile'),

  // Profile (new — full profile with editing fields)
  getOwnProfile: () => invoke('manage-profile', { action: 'get' }),
  syncDiscordProfile: (providerToken: string) => invoke('manage-profile', { action: 'sync-discord', provider_token: providerToken }),

  updateProfile: ({ bio, skill_tags, social_links, visibility }: ProfileUpdateParams) =>
    invoke('manage-profile', {
      action: 'update',
      bio,
      skill_tags,
      social_links,
      visibility,
    }),

  // Members
  getMembers: ({ search, page, pageSize, server_id }: MembersParams = {}) =>
    invoke('get-members', { search, page, pageSize, server_id }),

  // Profile Comments
  listComments: (profile_user_id: string, { page, pageSize }: PaginationParams = {}) =>
    invoke('profile-comments', {
      action: 'list',
      profile_user_id,
      page,
      pageSize,
    }),

  createComment: (profile_user_id: string, content: string) =>
    invoke('profile-comments', {
      action: 'create',
      profile_user_id,
      content,
    }),

  deleteComment: (id: string) =>
    invoke('profile-comments', {
      action: 'delete',
      id,
    }),

  // Announcements
  listAnnouncements: ({ page, pageSize, server_id }: PaginationParams & { server_id?: string } = {}) =>
    invoke('manage-announcements', {
      action: 'list',
      page,
      pageSize,
      server_id,
    }),

  createAnnouncement: ({ title, content, pinned, server_id }: AnnouncementParams) =>
    invoke('manage-announcements', {
      action: 'create',
      title,
      content,
      pinned,
      server_id,
    }),

  updateAnnouncement: (id: string, { title, content, pinned, server_id }: AnnouncementParams) =>
    invoke('manage-announcements', {
      action: 'update',
      id,
      title,
      content,
      pinned,
      server_id,
    }),

  deleteAnnouncement: (id: string, server_id?: string) =>
    invoke('manage-announcements', {
      action: 'delete',
      id,
      server_id,
    }),

  // Stats
  getStats: (server_id?: string) => invoke('get-stats', { server_id }),

  // Admin
  getUsers: (server_id?: string) => invoke('manage-users', { action: 'list', server_id }),

  updateUserRole: (userId: string, role: string, server_id?: string) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
    server_id,
  }),

  // Admin - User Actions
  banUser: (userId: string, reason: string, server_id?: string) => invoke('manage-users', {
    action: 'ban',
    user_id: userId,
    reason,
    server_id,
  }),

  unbanUser: (userId: string, server_id?: string) => invoke('manage-users', {
    action: 'unban',
    user_id: userId,
    server_id,
  }),

  kickUser: (userId: string, reason: string, server_id?: string) => invoke('manage-users', {
    action: 'kick',
    user_id: userId,
    reason,
    server_id,
  }),

  timeoutUser: (userId: string, durationMinutes: number, reason: string, server_id?: string) => invoke('manage-users', {
    action: 'timeout',
    user_id: userId,
    duration_minutes: durationMinutes,
    reason,
    server_id,
  }),

  getAuditLog: ({ page, pageSize, actionFilter, targetType, server_id }: AuditLogParams = {}) =>
    invoke('manage-users', {
      action: 'audit-log',
      page,
      pageSize,
      action_filter: actionFilter,
      target_type: targetType,
      server_id,
    }),

  // Admin - Roles
  listRoles: (server_id?: string) => invoke('manage-roles', { action: 'list', server_id }),

  createRole: ({ name, color, permissions, position, server_id }: RoleParams) =>
    invoke('manage-roles', { action: 'create', name, color, permissions, position, server_id }),

  updateRole: (id: string, { name, color, permissions, position, server_id }: RoleParams) =>
    invoke('manage-roles', { action: 'update', id, name, color, permissions, position, server_id }),

  deleteRole: (id: string, server_id?: string) => invoke('manage-roles', { action: 'delete', id, server_id }),

  // Admin - Tickets
  listTickets: ({ page, pageSize, status, server_id }: TicketParams = {}) =>
    invoke('manage-tickets', { action: 'list', page, pageSize, status, server_id }),

  createTicket: ({ title, content, category, priority, server_id }: TicketCreateParams) =>
    invoke('manage-tickets', { action: 'create', title, content, category, priority, server_id }),

  updateTicket: (id: string, { status, priority, assigned_to }: TicketUpdateParams) =>
    invoke('manage-tickets', { action: 'update', id, status, priority, assigned_to }),

  deleteTicket: (id: string, server_id?: string) => invoke('manage-tickets', { action: 'delete', id, server_id }),

  replyTicket: (ticketId: string, content: string) =>
    invoke('manage-tickets', { action: 'reply', ticket_id: ticketId, content }),

  getTicketReplies: (ticketId: string) =>
    invoke('manage-tickets', { action: 'replies', ticket_id: ticketId }),

  // Admin - Overview
  getAdminOverview: (server_id?: string) => invoke('admin-overview', { server_id }),

  // Admin - Settings
  listSettings: (server_id?: string) => invoke('admin-settings', { action: 'list', server_id }),

  getSetting: (key: string, server_id?: string) => invoke('admin-settings', { action: 'get', key, server_id }),

  updateSetting: (key: string, value: unknown, server_id?: string) => invoke('admin-settings', { action: 'update', key, value, server_id }),

  batchUpdateSettings: (settings: Record<string, unknown>, server_id?: string) =>
    invoke('admin-settings', { action: 'batch-update', settings, server_id }),

  // Todos
  listTodos: ({ page, pageSize, server_id }: PaginationParams & { server_id?: string } = {}) =>
    invoke('manage-todos', { action: 'list', page, pageSize, server_id }),

  createTodo: ({ title, is_public, server_id }: TodoCreateParams) =>
    invoke('manage-todos', { action: 'create', title, is_public, server_id }),

  updateTodo: (id: string, { title, completed }: TodoUpdateParams = {}) =>
    invoke('manage-todos', { action: 'update', id, title, completed }),

  deleteTodo: (id: string) =>
    invoke('manage-todos', { action: 'delete', id }),

  claimTodo: (id: string) =>
    invoke('manage-todos', { action: 'claim', id }),

  unclaimTodo: (id: string) =>
    invoke('manage-todos', { action: 'unclaim', id }),

  // Games
  listGameInvites: ({ page, pageSize, server_id }: PaginationParams & { server_id?: string } = {}) =>
    invoke('manage-games', { action: 'list-invites', page, pageSize, server_id }),

  createGameInvite: ({ game_type, title, description, max_players, server_id }: GameInviteParams) =>
    invoke('manage-games', { action: 'create-invite', game_type, title, description, max_players, server_id }),

  joinGameInvite: (id: string) =>
    invoke('manage-games', { action: 'join-invite', id }),

  leaveGameInvite: (id: string) =>
    invoke('manage-games', { action: 'leave-invite', id }),

  closeGameInvite: (id: string) =>
    invoke('manage-games', { action: 'close-invite', id }),

  submitGameScore: (score: number) =>
    invoke('manage-games', { action: 'submit-score', score }),

  getGameLeaderboard: (server_id?: string) =>
    invoke('manage-games', { action: 'leaderboard', server_id }),

  // Feedbacks
  listFeedbacks: ({ page, pageSize, category, server_id }: FeedbackParams = {}) =>
    invoke('manage-feedbacks', { action: 'list', page, pageSize, category, server_id }),

  createFeedback: ({ category, title, content, server_id }: FeedbackCreateParams) =>
    invoke('manage-feedbacks', { action: 'create', category, title, content, server_id }),

  voteFeedback: (feedback_id: string) =>
    invoke('manage-feedbacks', { action: 'vote', feedback_id }),

  updateFeedbackStatus: (id: string, status: string, server_id?: string) =>
    invoke('manage-feedbacks', { action: 'update-status', id, status, server_id }),

  deleteFeedback: (id: string, server_id?: string) =>
    invoke('manage-feedbacks', { action: 'delete', id, server_id }),

  // Levels
  getMyLevel: () =>
    invoke('manage-levels', { action: 'get' }),

  getLevelLeaderboard: (server_id?: string) =>
    invoke('manage-levels', { action: 'leaderboard', server_id }),

  grantBadge: (user_id: string, badge: string) =>
    invoke('manage-levels', { action: 'grant-badge', user_id, badge }),

  // Event Registration
  registerEvent: (event_id: string) =>
    invoke('manage-events', { action: 'register', event_id }),

  unregisterEvent: (event_id: string) =>
    invoke('manage-events', { action: 'unregister', event_id }),

  getEventRegistrations: (event_id: string) =>
    invoke('manage-events', { action: 'registrations', event_id }),

  // Servers
  listServers: () => invoke('manage-servers', { action: 'list' }),

  getServerSettings: (server_id: string) =>
    invoke('manage-servers', { action: 'get-settings', server_id }),

  updateServerSettings: (server_id: string, settings: Record<string, unknown>) =>
    invoke('manage-servers', { action: 'update-settings', server_id, settings }),

  getServerRole: (server_id: string) =>
    invoke('manage-servers', { action: 'get-role', server_id }),
}
