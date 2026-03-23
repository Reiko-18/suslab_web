import { useState, useEffect } from 'react'
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
import EventIcon from '@mui/icons-material/Event'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PeopleIcon from '@mui/icons-material/People'

export default function Events() {
  const { t } = useTranslation()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    edgeFunctions.getEvents()
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('events.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('events.subtitle')}</Typography>

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
                      <PeopleIcon fontSize="small" color="action" /><Typography variant="body2">{t('events.attendees', { count: event.attendees })}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  )
}
