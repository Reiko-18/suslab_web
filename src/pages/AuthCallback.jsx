import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../services/supabaseClient'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    // Supabase auto-detects the token from the URL hash on implicit flow.
    // We just need to wait for the session to be established.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/home', { replace: true })
      } else {
        // If no session yet, listen for auth state change
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            data.subscription.unsubscribe()
            navigate('/home', { replace: true })
          }
        })
        // Cleanup after 10s timeout to avoid infinite loading
        const timeout = setTimeout(() => {
          data.subscription.unsubscribe()
          navigate('/', { replace: true })
        }, 10000)
        return () => {
          clearTimeout(timeout)
          data.subscription.unsubscribe()
        }
      }
    })
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    </Box>
  )
}
