import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../services/supabaseClient'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState('Processing login...')

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        const url = window.location.href
        const hasCode = url.includes('code=')
        const hasToken = url.includes('access_token')

        if (!cancelled) setStatus(`URL detected: code=${hasCode}, token=${hasToken}`)

        // Wait a moment for Supabase to auto-process the URL
        await new Promise((r) => setTimeout(r, 1000))

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          if (!cancelled) setStatus(`Session error: ${error.message}`)
          setTimeout(() => navigate('/', { replace: true }), 3000)
          return
        }

        if (session) {
          if (!cancelled) setStatus(`Login successful! Redirecting... (user: ${session.user.email})`)
          setTimeout(() => navigate('/home', { replace: true }), 500)
          return
        }

        // No session yet — try exchangeCodeForSession if code is present
        if (hasCode) {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')
          if (code) {
            if (!cancelled) setStatus('Exchanging code for session...')
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
            if (exchangeError) {
              if (!cancelled) setStatus(`Code exchange failed: ${exchangeError.message}`)
              setTimeout(() => navigate('/', { replace: true }), 3000)
              return
            }
            const { data: { session: newSession } } = await supabase.auth.getSession()
            if (newSession && !cancelled) {
              setStatus(`Login successful! Redirecting...`)
              setTimeout(() => navigate('/home', { replace: true }), 500)
              return
            }
          }
        }

        // Fallback: listen for auth state change
        if (!cancelled) setStatus('Waiting for auth state change...')
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session && !cancelled) {
            listener.subscription.unsubscribe()
            setStatus('Login successful! Redirecting...')
            setTimeout(() => navigate('/home', { replace: true }), 500)
          }
        })

        // Timeout after 15s
        setTimeout(() => {
          if (!cancelled) {
            listener.subscription.unsubscribe()
            setStatus('Login timeout. Redirecting to home...')
            setTimeout(() => navigate('/', { replace: true }), 2000)
          }
        }, 15000)
      } catch (err) {
        if (!cancelled) setStatus(`Error: ${err.message ?? JSON.stringify(err)}`)
      }
    }

    handleCallback()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary" sx={{ maxWidth: 500, textAlign: 'center', wordBreak: 'break-all' }}>
        {status}
      </Typography>
    </Box>
  )
}
