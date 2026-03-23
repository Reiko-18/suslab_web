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

  // Profile
  getProfile: () => invoke('get-profile'),

  // Admin
  getUsers: () => invoke('manage-users', { action: 'list' }),

  updateUserRole: (userId, role) => invoke('manage-users', {
    action: 'update-role',
    user_id: userId,
    role,
  }),
}
