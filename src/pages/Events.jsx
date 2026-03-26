import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import EventIcon from '@mui/icons-material/Event'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PeopleIcon from '@mui/icons-material/People'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LevelCard from '../components/LevelCard'
import LeaderboardDialog from '../components/LeaderboardDialog'

export default function Events() {
  const { t } = useTranslation()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snack, setSnack] = useState(null)

  // Level state
  const [levelData, setLevelData] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])

  // Expanded events (for registrant list)
  const [expanded, setExpanded] = useState({})
  const [registrants, setRegistrants] = useState({})

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.getEvents()
      setEvents(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLevel = useCallback(async () => {
    try {
      const data = await edgeFunctions.getMyLevel()
      setLevelData(data)
    } catch (err) { console.error('Failed to load level:', err) }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadLevel() }, [loadLevel])

  const handleRegister = async (eventId) => {
    try {
      await edgeFunctions.registerEvent(eventId)
      setSnack({ severity: 'success', message: t('events.registered') })
      loadEvents()
      loadLevel()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnregister = async (eventId) => {
    try {
      await edgeFunctions.unregisterEvent(eventId)
      loadEvents()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggleExpand = async (eventId) => {
    const isExpanded = !!expanded[eventId]
    setExpanded((prev) => ({ ...prev, [eventId]: !isExpanded }))

    if (!isExpanded && !registrants[eventId]) {
      try {
        const data = await edgeFunctions.getEventRegistrations(eventId)
        setRegistrants((prev) => ({ ...prev, [eventId]: data ?? [] }))
      } catch (err) { console.error('Failed to load registrations:', err) }
    }
  }

  const handleOpenLeaderboard = async () => {
    try {
      const data = await edgeFunctions.getLevelLeaderboard()
      setLeaderboard(data ?? [])
      setShowLeaderboard(true)
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const leaderboardRows = leaderboard.map((e) => ({
    rank: e.rank,
    displayName: e.display_name,
    avatarUrl: e.avatar_url,
    value: e.xp,
  }))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('events.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('events.subtitle')}</Typography>

      {/* Level card */}
      {levelData && (
        <LevelCard
          level={levelData.level}
          xp={levelData.xp}
          badges={levelData.badges}
          onLeaderboard={handleOpenLeaderboard}
        />
      )}

      <LeaderboardDialog
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        title={t('levels.leaderboard')}
        rows={leaderboardRows}
        valueLabel="XP"
      />

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card><CardContent><Skeleton variant="text" width="60%" /><Skeleton variant="text" /><Skeleton variant="text" width="40%" /></CardContent></Card>
            </Grid>
          ))}
        </Grid>
      ) : error ? (
        <Card sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">{t('events.loadError')}</Typography></Card>
      ) : events.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">{t('events.empty')}</Typography></Card>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Chip icon={<EventIcon />} label={event.date} size="small" color="primary" variant="outlined" sx={{ mb: 1 }} />
                  <Typography variant="h6" gutterBottom>{event.title}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>{event.description}</Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" color="action" /><Typography variant="body2">{event.time}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOnIcon fontSize="small" color="action" /><Typography variant="body2">{event.location}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {t('events.attendees', { count: event.registration_count ?? event.attendees ?? 0 })}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Register/Unregister button */}
                  <Box sx={{ mt: 2 }}>
                    {event.registered ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleUnregister(event.id)}
                        >
                          {t('events.registered')}
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleRegister(event.id)}
                      >
                        {t('events.register')}
                      </Button>
                    )}
                  </Box>

                  {/* Expand registrants */}
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => handleToggleExpand(event.id)}
                    endIcon={expanded[event.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {t('events.registrants')}
                  </Button>

                  <Collapse in={!!expanded[event.id]}>
                    <Box sx={{ mt: 1 }}>
                      {registrants[event.id]?.length > 0 ? (
                        <AvatarGroup max={10} sx={{ justifyContent: 'flex-start' }}>
                          {registrants[event.id].map((r) => (
                            <Avatar key={r.user_id} src={r.avatar_url} alt={r.display_name} sx={{ width: 28, height: 28 }} />
                          ))}
                        </AvatarGroup>
                      ) : (
                        <Typography variant="caption" color="text.secondary">{t('events.noRegistrants')}</Typography>
                      )}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
