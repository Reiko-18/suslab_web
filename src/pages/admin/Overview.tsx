/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { Icon, Card, Alert, CircularProgress } from '../../components/ui'
import { Container, Grid } from '../../components/layout'
import AuditLogTable from '../../components/admin/AuditLogTable'

interface StatCardItem {
  icon: string
  label: string
  value: number
  color: string
}

export default function Overview() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    edgeFunctions.getAdminOverview()
      .then(setStats)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div css={css({ display: 'flex', justifyContent: 'center', padding: '80px 0' })}>
        <CircularProgress />
      </div>
    )
  }

  const statCards: StatCardItem[] = [
    { icon: 'group', label: t('admin.overview.totalUsers'), value: stats?.total_users ?? 0, color: 'var(--color-primary)' },
    { icon: 'confirmation_number', label: t('admin.overview.openTickets'), value: stats?.open_tickets ?? 0, color: 'var(--color-warning)' },
    { icon: 'feedback', label: t('admin.overview.openFeedback'), value: stats?.open_feedback ?? 0, color: 'var(--color-info, var(--color-primary))' },
    { icon: 'smart_toy', label: t('admin.overview.pendingBotActions'), value: stats?.pending_bot_actions ?? 0, color: 'var(--color-secondary, var(--color-primary))' },
  ]

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>
        {t('admin.overview.title')}
      </h1>

      {error && <Alert severity="error" css={css({ marginBottom: 16 })}>{error}</Alert>}

      <Grid columns={{ xs: 2, md: 4 }} gap={16} css={css({ marginBottom: 32 })}>
        {statCards.map((card) => (
          <Card key={card.label} css={css({ padding: 16, display: 'flex', alignItems: 'center', gap: 16 })}>
            <Icon name={card.icon} size={40} css={css({ color: card.color })} />
            <div>
              <p css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 })}>{card.value}</p>
              <p css={css({ fontSize: 14, color: 'var(--color-on-surface-muted)', margin: 0 })}>{card.label}</p>
            </div>
          </Card>
        ))}
      </Grid>

      <h2 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>{t('admin.overview.recentActivity')}</h2>
      <AuditLogTable compact initialData={stats?.recent_audit ?? []} />
    </Container>
  )
}
