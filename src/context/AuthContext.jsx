import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext(null)

const ROLE_LEVELS = { member: 1, moderator: 2, admin: 3 }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  function extractRole(user) {
    return user?.app_metadata?.role ?? 'member'
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setRole(session?.user ? extractRole(session.user) : null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setRole(session?.user ? extractRole(session.user) : null)
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const hasRole = (minimumRole) => {
    if (!role) return false
    return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[minimumRole] ?? 0)
  }

  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) console.error('Discord login error:', error.message)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error.message)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, hasRole, signInWithDiscord, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
