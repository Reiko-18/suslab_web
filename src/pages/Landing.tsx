import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech'
import FavoriteIcon from '@mui/icons-material/Favorite'
import CampaignIcon from '@mui/icons-material/Campaign'
import type { SvgIconComponent } from '@mui/icons-material'

interface FeatureItem {
  key: string
  icon: SvgIconComponent
  bg: string
  color: string
}

const FEATURES: FeatureItem[] = [
  { key: 'members', icon: PeopleIcon, bg: '#E8EDE5', color: '#4A7C59' },
  { key: 'events', icon: EventIcon, bg: '#FFF3E0', color: '#D97706' },
  { key: 'games', icon: SportsEsportsIcon, bg: '#EDE9FE', color: '#7C3AED' },
  { key: 'achievements', icon: MilitaryTechIcon, bg: '#DBEAFE', color: '#2563EB' },
  { key: 'feedback', icon: FavoriteIcon, bg: '#FCE7F3', color: '#EC4899' },
  { key: 'announcements', icon: CampaignIcon, bg: '#E8EDE5', color: '#4A7C59' },
]

export default function Landing() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (!loading && user) return <Navigate to="/home" replace />

  return (
    <Box sx={{ bgcolor: '#FAFAF7' }}>
      {/* Hero */}
      <Box sx={{
        py: { xs: 10, md: 16 }, textAlign: 'center',
        background: 'linear-gradient(180deg, #F5F0E8 0%, #E8EDE5 40%, #DDE8D6 70%, #D4E2CC 100%)',
      }}>
        <Container maxWidth="sm">
          <Typography sx={{
            fontSize: 14, fontWeight: 500, color: '#6B7B6B',
            letterSpacing: 2, textTransform: 'uppercase', mb: 2,
          }}>
            {t('landing.hero.welcomeTo')}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 40, md: 52 }, fontWeight: 800, color: '#2D3B2D',
            lineHeight: 1.1, mb: 3,
          }}>
            {t('landing.hero.title')}
          </Typography>
          <Typography sx={{
            fontSize: 17, color: '#5A6B5A', lineHeight: 1.6,
            maxWidth: 520, mx: 'auto', mb: 4,
          }}>
            {t('landing.hero.subtitle')}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 28, md: 36 }, fontWeight: 900, color: '#4A7C59',
            letterSpacing: 6, mt: 2,
          }}>
            SUS LAB
          </Typography>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography sx={{
          fontSize: 24, fontWeight: 700, color: '#2D3B2D',
          textAlign: 'center', mb: 5,
        }}>
          {t('landing.features.title')}
        </Typography>
        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          {FEATURES.map((feature) => (
            <Grid key={feature.key} size={{ xs: 6, sm: 4 }} sx={{ display: 'flex' }}>
              <Card sx={{
                width: '100%', minHeight: 160, borderRadius: 5, border: '1px solid #E8EDE5',
                boxShadow: 'none', transition: 'transform 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 4px 30px #00000006' },
              }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: '50%', bgcolor: feature.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 1.5,
                  }}>
                    <feature.icon sx={{ fontSize: 22, color: feature.color }} />
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#2D3B2D', mb: 0.5 }}>
                    {t(`landing.features.${feature.key}.title`)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7B6B', lineHeight: 1.5 }}>
                    {t(`landing.features.${feature.key}.desc`)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <Box sx={{
        py: { xs: 6, md: 8 }, textAlign: 'center',
        background: 'linear-gradient(0deg, #E8EDE5, #FAFAF7)',
      }}>
        <Container maxWidth="sm">
          <Typography sx={{ fontSize: 32, mb: 1 }}>🌱</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#2D3B2D', mb: 1.5 }}>
            {t('landing.cta.title')}
          </Typography>
          <Typography sx={{ fontSize: 15, color: '#5A6B5A', lineHeight: 1.6, mb: 3, maxWidth: 440, mx: 'auto' }}>
            {t('landing.cta.desc')}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 22, md: 28 }, fontWeight: 900, color: '#4A7C59',
            letterSpacing: 6,
          }}>
            SUS LAB
          </Typography>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 2.5, textAlign: 'center', bgcolor: '#E8EDE5' }}>
        <Typography sx={{ fontSize: 12, color: '#6B7B6B' }}>
          {t('landing.footer.copyright', { year: new Date().getFullYear() })}
        </Typography>
      </Box>
    </Box>
  )
}
