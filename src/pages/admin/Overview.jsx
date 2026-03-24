// src/pages/admin/Overview.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import PeopleIcon from '@mui/icons-material/People'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import FeedbackIcon from '@mui/icons-material/Feedback'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import AuditLogTable from '../../components/admin/AuditLogTable'

export default function Overview() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    edgeFunctions.getAdminOverview()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  const statCards = [
    { icon: PeopleIcon, label: t('admin.overview.totalUsers'), value: stats?.total_users ?? 0, color: 'primary.main' },
    { icon: ConfirmationNumberIcon, label: t('admin.overview.openTickets'), value: stats?.open_tickets ?? 0, color: 'warning.main' },
    { icon: FeedbackIcon, label: t('admin.overview.openFeedback'), value: stats?.open_feedback ?? 0, color: 'info.main' },
    { icon: SmartToyIcon, label: t('admin.overview.pendingBotActions'), value: stats?.pending_bot_actions ?? 0, color: 'secondary.main' },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.overview.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <Grid size={{ xs: 6, md: 3 }} key={label}>
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Icon sx={{ fontSize: 40, color }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" sx={{ mb: 2 }}>{t('admin.overview.recentActivity')}</Typography>
      <AuditLogTable compact initialData={stats?.recent_audit ?? []} />
    </Container>
  )
}
