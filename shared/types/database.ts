import type { DashboardRole } from './roles'

export interface Server {
  id: string
  discord_guild_id: string
  name: string
  icon_url: string | null
  owner_id: string | null
  settings: ServerSettings
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServerSettings {
  ticket_channels: string[]
  notification_webhook_url: string
  notify_new_ticket: boolean
  notify_new_feedback: boolean
  notify_new_user: boolean
  notify_ticket_status_change: boolean
  allowed_roles: string[]
  role_mapping: Record<string, DashboardRole>
}

export interface ServerMember {
  server_id: string
  user_id: string
  discord_roles: string[]
  joined_at: string
}

export type TicketCategory = 'general' | 'bug' | 'request' | 'report'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketSource = 'web' | 'discord'
export type FeedbackCategory = 'feature' | 'event' | 'bug'
export type FeedbackStatus = 'open' | 'reviewed' | 'accepted' | 'rejected'

export type BotActionType =
  | 'ban_user'
  | 'unban_user'
  | 'kick_user'
  | 'timeout_user'
  | 'sync_role'
  | 'send_message'
  | 'update_thread'

export interface BotAction {
  id: string
  action_type: BotActionType
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  server_id: string | null
  created_by: string | null
  created_at: string
  processed_at: string | null
}

export interface UserSettings {
  language?: 'en' | 'ja' | 'zh-CN' | 'zh-TW'
}

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  ticket_channels: [],
  notification_webhook_url: '',
  notify_new_ticket: true,
  notify_new_feedback: true,
  notify_new_user: true,
  notify_ticket_status_change: true,
  allowed_roles: [],
  role_mapping: {},
}
