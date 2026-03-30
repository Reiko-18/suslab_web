/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { Icon, Card } from '../components/ui'
import { Container, Grid } from '../components/layout'

interface FeatureItem {
  key: string
  icon: string
  bg: string
  color: string
}

const FEATURES: FeatureItem[] = [
  { key: 'members', icon: 'group', bg: '#E8EDE5', color: '#4A7C59' },
  { key: 'events', icon: 'event', bg: '#FFF3E0', color: '#D97706' },
  { key: 'games', icon: 'sports_esports', bg: '#EDE9FE', color: '#7C3AED' },
  { key: 'achievements', icon: 'military_tech', bg: '#DBEAFE', color: '#2563EB' },
  { key: 'feedback', icon: 'favorite', bg: '#FCE7F3', color: '#EC4899' },
  { key: 'announcements', icon: 'campaign', bg: '#E8EDE5', color: '#4A7C59' },
]

export default function Landing() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (!loading && user) return <Navigate to="/home" replace />

  return (
    <div css={css({ background: '#FAFAF7' })}>
      {/* Hero */}
      <div css={css({
        padding: '80px 0',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #F5F0E8 0%, #E8EDE5 40%, #DDE8D6 70%, #D4E2CC 100%)',
        '@media (min-width: 769px)': { padding: '128px 0' },
      })}>
        <Container maxWidth="sm">
          <p css={css({
            fontSize: 14, fontWeight: 500, color: '#6B7B6B',
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, margin: '0 0 16px',
          })}>
            {t('landing.hero.welcomeTo')}
          </p>
          <h1 css={css({
            fontSize: 40, fontWeight: 800, color: '#2D3B2D',
            lineHeight: 1.1, marginBottom: 24, margin: '0 0 24px',
            '@media (min-width: 769px)': { fontSize: 52 },
          })}>
            {t('landing.hero.title')}
          </h1>
          <p css={css({
            fontSize: 17, color: '#5A6B5A', lineHeight: 1.6,
            maxWidth: 520, margin: '0 auto 32px',
          })}>
            {t('landing.hero.subtitle')}
          </p>
          <p css={css({
            fontSize: 28, fontWeight: 900, color: '#4A7C59',
            letterSpacing: 6, marginTop: 16, margin: '16px 0 0',
            '@media (min-width: 769px)': { fontSize: 36 },
          })}>
            SUS LAB
          </p>
        </Container>
      </div>

      {/* Features */}
      <Container maxWidth="lg" css={css({
        padding: '48px 16px',
        '@media (min-width: 769px)': { padding: '64px 16px' },
      })}>
        <h2 css={css({
          fontSize: 24, fontWeight: 700, color: '#2D3B2D',
          textAlign: 'center', marginBottom: 40, margin: '0 0 40px',
        })}>
          {t('landing.features.title')}
        </h2>
        <Grid columns={{ xs: 2, sm: 3 }} gap={20}>
          {FEATURES.map((feature) => (
            <Card key={feature.key} css={css({
              minHeight: 160, borderRadius: 20, border: '1px solid #E8EDE5',
              boxShadow: 'none', transition: 'transform 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 4px 30px #00000006' },
            })}>
              <div css={css({ textAlign: 'center', padding: '24px 16px' })}>
                <div css={css({
                  width: 44, height: 44, borderRadius: '50%', background: feature.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                })}>
                  <Icon name={feature.icon} size={22} css={css({ color: feature.color })} />
                </div>
                <p css={css({ fontSize: 14, fontWeight: 600, color: '#2D3B2D', marginBottom: 4, margin: '0 0 4px' })}>
                  {t(`landing.features.${feature.key}.title`)}
                </p>
                <p css={css({ fontSize: 12, color: '#6B7B6B', lineHeight: 1.5, margin: 0 })}>
                  {t(`landing.features.${feature.key}.desc`)}
                </p>
              </div>
            </Card>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <div css={css({
        padding: '48px 0',
        textAlign: 'center',
        background: 'linear-gradient(0deg, #E8EDE5, #FAFAF7)',
        '@media (min-width: 769px)': { padding: '64px 0' },
      })}>
        <Container maxWidth="sm">
          <p css={css({ fontSize: 32, marginBottom: 8, margin: '0 0 8px' })}>🌱</p>
          <h2 css={css({ fontSize: 24, fontWeight: 700, color: '#2D3B2D', marginBottom: 12, margin: '0 0 12px' })}>
            {t('landing.cta.title')}
          </h2>
          <p css={css({ fontSize: 15, color: '#5A6B5A', lineHeight: 1.6, marginBottom: 24, maxWidth: 440, margin: '0 auto 24px' })}>
            {t('landing.cta.desc')}
          </p>
          <p css={css({
            fontSize: 22, fontWeight: 900, color: '#4A7C59',
            letterSpacing: 6, margin: 0,
            '@media (min-width: 769px)': { fontSize: 28 },
          })}>
            SUS LAB
          </p>
        </Container>
      </div>

      {/* Footer */}
      <div css={css({ padding: '20px 0', textAlign: 'center', background: '#E8EDE5' })}>
        <p css={css({ fontSize: 12, color: '#6B7B6B', margin: 0 })}>
          {t('landing.footer.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  )
}
