import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { edgeFunctions } from '../services/edgeFunctions'

export type Role = 'member' | 'moderator' | 'admin'

export interface ServerInfo {
  id: string
  discord_guild_id: string
  name: string
  icon_url: string | null
  user_role: Role
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  role: Role | null         // role in active server
  servers: ServerInfo[]
  activeServer: string | null  // server uuid
  loading: boolean
  hasRole: (minimumRole: Role) => boolean
  switchServer: (serverId: string) => Promise<void>
  signInWithDiscord: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const ROLE_LEVELS: Record<Role, number> = { member: 1, moderator: 2, admin: 3 }
const ACTIVE_SERVER_KEY = 'suslab-active-server'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [activeServer, setActiveServer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function extractRole(u: User): Role {
    const raw = u?.app_metadata?.role
    if (raw === 'moderator' || raw === 'admin') return raw
    return 'member'
  }

  async function loadServers(u: User): Promise<void> {
    try {
      const data = await edgeFunctions.listServers() as { servers?: ServerInfo[] }
      const serverList: ServerInfo[] = data?.servers ?? []
      setServers(serverList)

      if (serverList.length === 0) return

      // Restore previously active server from localStorage
      const stored = localStorage.getItem(ACTIVE_SERVER_KEY)
      const match = stored ? serverList.find(s => s.id === stored) : null
      const resolved = match ?? serverList[0]

      setActiveServer(resolved.id)
      setRole(resolved.user_role as Role)
      localStorage.setItem(ACTIVE_SERVER_KEY, resolved.id)
    } catch {
      // Fall back to JWT role if listServers fails
      setRole(extractRole(u))
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      clearTimeout(timeout)
      setSession(sess)
      const currentUser = sess?.user ?? null
      setUser(currentUser)

      if (!currentUser) {
        setRole(null)
        setServers([])
        setActiveServer(null)
        setLoading(false)
        return
      }

      // Set JWT role immediately as fallback, then fetch servers
      setRole(extractRole(currentUser))

      if (event === 'SIGNED_IN' && sess?.provider_token) {
        edgeFunctions.syncDiscordProfile(sess.provider_token).catch(() => {})
      }

      // Load servers and override role with server-specific role
      loadServers(currentUser).finally(() => setLoading(false))
    })

    return () => {
      clearTimeout(timeout)
      data.subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasRole = (minimumRole: Role): boolean => {
    if (!role) return false
    return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[minimumRole] ?? 0)
  }

  const switchServer = async (serverId: string): Promise<void> => {
    const server = servers.find(s => s.id === serverId)
    if (!server) return
    setActiveServer(serverId)
    setRole(server.user_role as Role)
    localStorage.setItem(ACTIVE_SERVER_KEY, serverId)
  }

  const signInWithDiscord = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) console.error('Discord login error:', error.message)
  }

  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error.message)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      servers,
      activeServer,
      loading,
      hasRole,
      switchServer,
      signInWithDiscord,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
