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
    const url = window.location.href
    const hasCode = window.location.search.includes('code=')
    const hasHash = window.location.hash.includes('access_token')

    setStatus(`Detected: code=${hasCode}, hash=${hasHash}`)

    // Supabase SDK auto-detects code/hash on getSession()
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return

      if (error) {
        setStatus(`Error: ${error.message}`)
        setTimeout(() => navigate('/', { replace: true }), 3000)
        return
      }

      if (session) {
        setStatus(`Success! User: ${session.user.email}`)
        navigate('/home', { replace: true })
        return
      }

      // No session yet — wait for auth state change
      setStatus('Waiting for session...')
      const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
        if (cancelled) return
        if (event === 'SIGNED_IN' && sess) {
          listener.subscription.unsubscribe()
          navigate('/home', { replace: true })
        }
      })

      setTimeout(() => {
        if (!cancelled) {
          listener.subscription.unsubscribe()
          setStatus('Timeout — redirecting...')
          setTimeout(() => navigate('/', { replace: true }), 1000)
        }
      }, 10000)
    })

    return () => { cancelled = true }
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{status}</Typography>
    </Box>
  )
}
