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
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        // 1. Check for PKCE flow (?code=...)
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            if (!cancelled) setError(exchangeError.message)
            return
          }
          if (!cancelled) navigate('/home', { replace: true })
          return
        }

        // 2. Check for implicit flow (#access_token=...)
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          // Supabase client auto-detects hash on getSession
          // Give it a moment to process
          await new Promise((r) => setTimeout(r, 500))
          const { data: { session } } = await supabase.auth.getSession()
          if (session && !cancelled) {
            navigate('/home', { replace: true })
            return
          }
        }

        // 3. Fallback: poll getSession a few times
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          if (cancelled) return
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            navigate('/home', { replace: true })
            return
          }
        }

        // 4. Nothing worked — go back to landing
        if (!cancelled) {
          setError('Login timeout. Please try again.')
          setTimeout(() => navigate('/', { replace: true }), 2000)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Unknown error')
      }
    }

    handleCallback()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      {error
        ? <Typography color="error">{error}</Typography>
        : <Typography color="text.secondary">{t('common.loading')}</Typography>
      }
    </Box>
  )
}
