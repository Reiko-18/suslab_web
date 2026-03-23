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
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        data.subscription.unsubscribe()
        navigate('/home', { replace: true })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    </Box>
  )
}
