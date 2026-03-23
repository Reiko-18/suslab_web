import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

export default function ProtectedRoute({ children, minimumRole = 'member' }) {
  const { user, loading, hasRole } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (!hasRole(minimumRole)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Card sx={{ textAlign: 'center', maxWidth: 400, p: 4 }}>
          <Typography variant="h5" gutterBottom>{t('common.noPermission')}</Typography>
          <Typography color="text.secondary">{t('common.noPermissionDesc', { role: minimumRole })}</Typography>
        </Card>
      </Box>
    )
  }

  return children ?? <Outlet />
}
