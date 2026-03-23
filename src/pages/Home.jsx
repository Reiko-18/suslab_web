import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Button from '@mui/material/Button'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import CampaignIcon from '@mui/icons-material/Campaign'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import FeedbackIcon from '@mui/icons-material/Feedback'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAnn, setLoadingAnn] = useState(true)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || meta.name || 'User'

  useEffect(() => {
    edgeFunctions.getStats()
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => setLoadingStats(false))

    edgeFunctions.listAnnouncements({ page: 1, pageSize: 3 })
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnn(false))
  }, [])

  const statItems = [
    { label: t('home.stats.members'), value: stats?.memberCount, icon: <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
    { label: t('home.stats.events'), value: stats?.eventCount, icon: <EventIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
    { label: t('home.stats.announcements'), value: stats?.announcementCount, icon: <CampaignIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
  ]

  const quickNavItems = [
    { label: t('nav.members'), path: '/members', icon: <PeopleIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.events'), path: '/events', icon: <EventIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.games'), path: '/games', icon: <SportsEsportsIcon sx={{ fontSize: 36 }} /> },
    { label: t('nav.feedback'), path: '/feedback', icon: <FeedbackIcon sx={{ fontSize: 36 }} /> },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Welcome */}
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {t('home.welcome', { name: displayName })}
      </Typography>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statItems.map((item) => (
          <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                {item.icon}
                {loadingStats ? (
                  <Skeleton variant="text" width={60} sx={{ mx: 'auto', fontSize: '2rem' }} />
                ) : statsError ? (
                  <Typography color="error" variant="body2">{t('home.statsError')}</Typography>
                ) : (
                  <Typography variant="h3" sx={{ fontWeight: 700, my: 0.5 }}>
                    {item.value ?? 0}
                  </Typography>
                )}
                <Typography color="text.secondary">{item.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Latest Announcements */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('home.latestAnnouncements')}
            </Typography>
            <Button size="small" onClick={() => navigate('/announcements')}>
              {t('home.viewAll')}
            </Button>
          </Box>
          {loadingAnn ? (
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="text" height={40} />)}
            </Stack>
          ) : announcements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('announcements.empty')}
            </Typography>
          ) : (
            <List disablePadding>
              {announcements.map((ann) => (
                <ListItem key={ann.id} disablePadding>
                  <ListItemButton onClick={() => navigate('/announcements')}>
                    <ListItemText
                      primary={ann.title}
                      secondary={new Date(ann.created_at).toLocaleDateString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {t('home.quickNav')}
      </Typography>
      <Grid container spacing={2}>
        {quickNavItems.map((item) => (
          <Grid size={{ xs: 6, sm: 3 }} key={item.path}>
            <Card>
              <CardActionArea onClick={() => navigate(item.path)} sx={{ py: 3, textAlign: 'center' }}>
                {item.icon}
                <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>
                  {item.label}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}
