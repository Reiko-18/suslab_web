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
}

export interface AnnouncementParams {
  title: string
  content: string
  pinned?: boolean
}

export interface AuditLogParams extends PaginationParams {
  actionFilter?: string
  targetType?: string
}

export interface RoleParams {
  name: string
  color?: string
  permissions?: string[]
  position?: number
}

export interface TicketParams extends PaginationParams {
  status?: string
}

export interface TicketCreateParams {
  title: string
  content: string
  category?: string
  priority?: string
}

export interface TicketUpdateParams {
  status?: string
  priority?: string
  assigned_to?: string
}

export interface TodoCreateParams {
  title: string
  is_public?: boolean
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
}

export interface FeedbackParams extends PaginationParams {
  category?: string
}

export interface FeedbackCreateParams {
  category: string
  title: string
  content: string
}

export const edgeFunctions = {
  // Events
  getEvents: () => invoke('get-events'),

  createEvent: (event: EventParams) => invoke('manage-events', {
    action: 'create',
    ...event,
  }),

  updateEvent: (id: string, updates: EventParams) => invoke('manage-events', {
    action: 'update',
    id,
    ...updates,
  }),

  deleteEvent: (id: string) => invoke('manage-events', {
    action: 'delete',
    id,
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
  getMembers: ({ search, page, pageSize }: MembersParams = {}) =>
    invoke('get-members', { search, page, pageSize }),

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
  listAnnouncements: ({ page, pageSize }: PaginationParams = {}) =>
    invoke('manage-announcements', {
      action: 'list',
      page,
      pageSize,
    }),

  createAnnouncement: ({ title, content, pinned }: AnnouncementParams) =>
    invoke('manage-announcements', {
      action: 'create',
      title,
      content,
      pinned,
    }),

  updateAnnouncement: (id: string, { title, content, pinned }: AnnouncementParams) =>
    invoke('manage-announcements', {
      action: 'update',
      id,
      title,
      content,
      pinned,
    }),

  deleteAnnouncement: (id: string) =>
    invoke('manage-announcements', {
      action: 'delete',
      id,
    }),

  // Stats
  getStats: () => invoke('get-stats'),

  // Admin
  getUsers: () => invoke('manage-users', { action: 'list' }),

  updateUserRole: (userId: string, role: string) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
  }),

  // Admin - User Actions
  banUser: (userId: string, reason: string) => invoke('manage-users', {
    action: 'ban',
    user_id: userId,
    reason,
  }),

  unbanUser: (userId: string) => invoke('manage-users', {
    action: 'unban',
    user_id: userId,
  }),

  kickUser: (userId: string, reason: string) => invoke('manage-users', {
    action: 'kick',
    user_id: userId,
    reason,
  }),

  timeoutUser: (userId: string, durationMinutes: number, reason: string) => invoke('manage-users', {
    action: 'timeout',
    user_id: userId,
    duration_minutes: durationMinutes,
    reason,
  }),

  getAuditLog: ({ page, pageSize, actionFilter, targetType }: AuditLogParams = {}) =>
    invoke('manage-users', {
      action: 'audit-log',
      page,
      pageSize,
      action_filter: actionFilter,
      target_type: targetType,
    }),

  // Admin - Roles
  listRoles: () => invoke('manage-roles', { action: 'list' }),

  createRole: ({ name, color, permissions, position }: RoleParams) =>
    invoke('manage-roles', { action: 'create', name, color, permissions, position }),

  updateRole: (id: string, { name, color, permissions, position }: RoleParams) =>
    invoke('manage-roles', { action: 'update', id, name, color, permissions, position }),

  deleteRole: (id: string) => invoke('manage-roles', { action: 'delete', id }),

  // Admin - Tickets
  listTickets: ({ page, pageSize, status }: TicketParams = {}) =>
    invoke('manage-tickets', { action: 'list', page, pageSize, status }),

  createTicket: ({ title, content, category, priority }: TicketCreateParams) =>
    invoke('manage-tickets', { action: 'create', title, content, category, priority }),

  updateTicket: (id: string, { status, priority, assigned_to }: TicketUpdateParams) =>
    invoke('manage-tickets', { action: 'update', id, status, priority, assigned_to }),

  deleteTicket: (id: string) => invoke('manage-tickets', { action: 'delete', id }),

  replyTicket: (ticketId: string, content: string) =>
    invoke('manage-tickets', { action: 'reply', ticket_id: ticketId, content }),

  getTicketReplies: (ticketId: string) =>
    invoke('manage-tickets', { action: 'replies', ticket_id: ticketId }),

  // Admin - Overview
  getAdminOverview: () => invoke('admin-overview', {}),

  // Admin - Settings
  listSettings: () => invoke('admin-settings', { action: 'list' }),

  getSetting: (key: string) => invoke('admin-settings', { action: 'get', key }),

  updateSetting: (key: string, value: unknown) => invoke('admin-settings', { action: 'update', key, value }),

  batchUpdateSettings: (settings: Record<string, unknown>) =>
    invoke('admin-settings', { action: 'batch-update', settings }),

  processDiscordActions: (limit = 20, guild_id?: string) =>
    invoke('process-discord-actions', { limit, guild_id }),

  // Todos
  listTodos: ({ page, pageSize }: PaginationParams = {}) =>
    invoke('manage-todos', { action: 'list', page, pageSize }),

  createTodo: ({ title, is_public }: TodoCreateParams) =>
    invoke('manage-todos', { action: 'create', title, is_public }),

  updateTodo: (id: string, { title, completed }: TodoUpdateParams = {}) =>
    invoke('manage-todos', { action: 'update', id, title, completed }),

  deleteTodo: (id: string) =>
    invoke('manage-todos', { action: 'delete', id }),

  claimTodo: (id: string) =>
    invoke('manage-todos', { action: 'claim', id }),

  unclaimTodo: (id: string) =>
    invoke('manage-todos', { action: 'unclaim', id }),

  // Games
  listGameInvites: ({ page, pageSize }: PaginationParams = {}) =>
    invoke('manage-games', { action: 'list-invites', page, pageSize }),

  createGameInvite: ({ game_type, title, description, max_players }: GameInviteParams) =>
    invoke('manage-games', { action: 'create-invite', game_type, title, description, max_players }),

  joinGameInvite: (id: string) =>
    invoke('manage-games', { action: 'join-invite', id }),

  leaveGameInvite: (id: string) =>
    invoke('manage-games', { action: 'leave-invite', id }),

  closeGameInvite: (id: string) =>
    invoke('manage-games', { action: 'close-invite', id }),

  submitGameScore: (score: number) =>
    invoke('manage-games', { action: 'submit-score', score }),

  getGameLeaderboard: () =>
    invoke('manage-games', { action: 'leaderboard' }),

  // Feedbacks
  listFeedbacks: ({ page, pageSize, category }: FeedbackParams = {}) =>
    invoke('manage-feedbacks', { action: 'list', page, pageSize, category }),

  createFeedback: ({ category, title, content }: FeedbackCreateParams) =>
    invoke('manage-feedbacks', { action: 'create', category, title, content }),

  voteFeedback: (feedback_id: string) =>
    invoke('manage-feedbacks', { action: 'vote', feedback_id }),

  updateFeedbackStatus: (id: string, status: string) =>
    invoke('manage-feedbacks', { action: 'update-status', id, status }),

  deleteFeedback: (id: string) =>
    invoke('manage-feedbacks', { action: 'delete', id }),

  // Levels
  getMyLevel: () =>
    invoke('manage-levels', { action: 'get' }),

  getLevelLeaderboard: () =>
    invoke('manage-levels', { action: 'leaderboard' }),

  grantBadge: (user_id: string, badge: string) =>
    invoke('manage-levels', { action: 'grant-badge', user_id, badge }),

  // Event Registration
  registerEvent: (event_id: string) =>
    invoke('manage-events', { action: 'register', event_id }),

  unregisterEvent: (event_id: string) =>
    invoke('manage-events', { action: 'unregister', event_id }),

  getEventRegistrations: (event_id: string) =>
    invoke('manage-events', { action: 'registrations', event_id }),
}
