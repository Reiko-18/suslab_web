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
    // Use onAuthStateChange as the single source of truth.
    // The INITIAL_SESSION event fires AFTER URL hash processing completes,
    // so it correctly picks up tokens from OAuth implicit flow redirects.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setRole(session?.user ? extractRole(session.user) : null)
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setLoading(false)
      }
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
