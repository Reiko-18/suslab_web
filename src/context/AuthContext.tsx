import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { edgeFunctions } from '../services/edgeFunctions'

export type Role = 'member' | 'moderator' | 'admin'

export interface AuthContextType {
  user: User | null
  session: Session | null
  role: Role | null
  loading: boolean
  hasRole: (minimumRole: Role) => boolean
  signInWithDiscord: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const ROLE_LEVELS: Record<Role, number> = { member: 1, moderator: 2, admin: 3 }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  function extractRole(u: User): Role {
    const raw = u?.app_metadata?.role
    if (raw === 'moderator' || raw === 'admin') return raw
    return 'member'
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      clearTimeout(timeout)
      setSession(sess)
      setUser(sess?.user ?? null)
      setRole(sess?.user ? extractRole(sess.user) : null)
      setLoading(false)

      if (event === 'SIGNED_IN' && sess?.provider_token) {
        edgeFunctions.syncDiscordProfile(sess.provider_token).catch(() => {})
      }
    })

    return () => {
      clearTimeout(timeout)
      data.subscription.unsubscribe()
    }
  }, [])

  const hasRole = (minimumRole: Role): boolean => {
    if (!role) return false
    return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[minimumRole] ?? 0)
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
    <AuthContext.Provider value={{ user, session, role, loading, hasRole, signInWithDiscord, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
