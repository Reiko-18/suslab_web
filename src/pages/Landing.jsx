import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import FeedbackIcon from '@mui/icons-material/Feedback'
import CampaignIcon from '@mui/icons-material/Campaign'
import LoginIcon from '@mui/icons-material/Login'

const FEATURES = [
  { key: 'members', icon: PeopleIcon },
  { key: 'events', icon: EventIcon },
  { key: 'games', icon: SportsEsportsIcon },
  { key: 'achievements', icon: EmojiEventsIcon },
  { key: 'feedback', icon: FeedbackIcon },
  { key: 'announcements', icon: CampaignIcon },
]

const STATS = [
  { key: 'members', value: '500+' },
  { key: 'events', value: '120+' },
  { key: 'partners', value: '30+' },
]

export default function Landing() {
  const { t } = useTranslation()
  const { user, loading, signInWithDiscord } = useAuth()

  // Temporary debug — remove after fixing auth
  const debugInfo = `loading=${loading}, user=${user ? user.email : 'null'}, hash=${window.location.hash ? 'yes' : 'no'}, search=${window.location.search ? 'yes' : 'no'}, INITIAL=${window.__INITIAL_URL__}, NOW=${window.location.href}`

  if (!loading && user) return <Navigate to="/home" replace />

  return (
    <Box>
      {/* Temporary debug banner */}
      <Box sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', p: 1, fontSize: 12, wordBreak: 'break-all' }}>
        DEBUG: {debugInfo}
      </Box>
      {/* Hero */}
      <Box sx={{
        py: { xs: 8, md: 14 }, textAlign: 'center',
        background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.13)}, ${alpha(theme.palette.secondary.main, 0.13)})`,
      }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>{t('landing.hero.title')}</Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            {t('landing.hero.subtitle')}
          </Typography>
          <Button variant="contained" size="large" startIcon={<LoginIcon />} onClick={signInWithDiscord}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: 3 }}
          >
            {t('landing.hero.cta')}
          </Button>
        </Container>
      </Box>

      {/* Stats */}
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" justifyContent="center" spacing={{ xs: 4, md: 8 }}>
          {STATS.map(({ key, value }) => (
            <Box key={key} sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>{value}</Typography>
              <Typography color="text.secondary">{t(`landing.stats.${key}`)}</Typography>
            </Box>
          ))}
        </Stack>
      </Container>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, textAlign: 'center', mb: 4 }}>
          {t('landing.features.title')}
        </Typography>
        <Grid container spacing={3}>
          {FEATURES.map(({ key, icon: Icon }) => (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Icon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>{t(`landing.features.${key}.title`)}</Typography>
                  <Typography color="text.secondary">{t(`landing.features.${key}.desc`)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <Paper sx={{ py: 8, textAlign: 'center', mx: 2, borderRadius: 4, mb: 4 }} elevation={0}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{t('landing.cta.title')}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{t('landing.cta.desc')}</Typography>
        <Button variant="contained" size="large" startIcon={<LoginIcon />} onClick={signInWithDiscord}>
          {t('landing.hero.cta')}
        </Button>
      </Paper>

      {/* Footer */}
      <Box sx={{ py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary">
          {t('landing.footer.copyright', { year: new Date().getFullYear() })}
        </Typography>
      </Box>
    </Box>
  )
}
