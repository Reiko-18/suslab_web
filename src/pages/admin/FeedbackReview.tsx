/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { useActiveServer } from '../../hooks/useActiveServer'
import { Icon, Button, Chip, Select, Alert, CircularProgress, Tabs, Table } from '../../components/ui'
import { Container } from '../../components/layout'

const CATEGORY_TABS = ['all', 'feature', 'event', 'bug'] as const
const STATUS_COLORS: Record<string, string> = {
  open: 'var(--color-info, var(--color-primary))',
  reviewed: 'var(--color-warning)',
  accepted: 'var(--color-success)',
  rejected: 'var(--color-error)',
}
const CATEGORY_COLORS: Record<string, string> = {
  feature: 'var(--color-primary)',
  event: 'var(--color-secondary, var(--color-primary))',
  bug: 'var(--color-error)',
}

export default function FeedbackReview() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categoryTab, setCategoryTab] = useState('all')

  const serverId = useActiveServer()
  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    let cancelled = false
    edgeFunctions.listFeedbacks({ category: categoryTab === 'all' ? undefined : categoryTab, server_id: serverId })
      .then((data: any) => { if (!cancelled) { setFeedbacks(data?.feedbacks ?? []); setLoading(false) } })
      .catch((err: any) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [categoryTab, serverId])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, newStatus, serverId)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)))
      setNotice(t('admin.feedbackReview.statusUpdated'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id, serverId)
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      setNotice(t('feedback.deleted'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const columns = [
    {
      key: 'title',
      header: t('feedback.titleLabel'),
      render: (f: any) => (
        <div>
          <p css={css({ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-on-surface)' })}>{f.title}</p>
          <p css={css({
            fontSize: 12, color: 'var(--color-on-surface-muted)', margin: 0,
            maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          })}>
            {f.content}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('feedback.categoryLabel'),
      render: (f: any) => <Chip label={t(`feedback.${f.category}`)} size="small" color={CATEGORY_COLORS[f.category] || undefined} />,
    },
    {
      key: 'votes',
      header: '',
      render: (f: any) => (
        <div css={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
          <Icon name="thumb_up" size={16} />
          <span>{f.vote_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('admin.feedbackReview.currentStatus'),
      render: (f: any) => <Chip label={t(`feedback.status.${f.status}`)} size="small" color={STATUS_COLORS[f.status] || undefined} />,
    },
    {
      key: 'changeStatus',
      header: t('feedback.changeStatus'),
      render: (f: any) => (
        <Select
          value={f.status}
          onChange={(val: string) => handleStatusChange(f.id, val)}
          options={['open', 'reviewed', 'accepted', 'rejected'].map((s) => ({
            value: s,
            label: t(`feedback.status.${s}`),
          }))}
        />
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            render: (f: any) => (
              <Button variant="icon" onClick={() => handleDelete(f.id)} css={css({ color: 'var(--color-error)' })}>
                <Icon name="delete" size={18} />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>
        {t('admin.feedbackReview.title')}
      </h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>
        {t('admin.feedbackReview.desc')}
      </p>

      {notice && <Alert severity="success" onClose={() => setNotice(null)} css={css({ marginBottom: 16 })}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} css={css({ marginBottom: 16 })}>{error}</Alert>}

      <Tabs
        tabs={CATEGORY_TABS.map((c) => ({
          label: c === 'all' ? t('feedback.all') : t(`feedback.${c}`),
          value: c,
        }))}
        value={categoryTab}
        onChange={setCategoryTab}
      />

      <div css={css({ marginTop: 16 })}>
        {loading ? (
          <div css={css({ display: 'flex', justifyContent: 'center', padding: '48px 0' })}><CircularProgress /></div>
        ) : (
          <>
            <Table
              columns={columns}
              data={feedbacks}
              keyExtractor={(f: any) => f.id}
            />
            {feedbacks.length === 0 && (
              <p css={css({ textAlign: 'center', color: 'var(--color-on-surface-muted)', padding: '32px 0' })}>
                {t('feedback.empty')}
              </p>
            )}
          </>
        )}
      </div>
    </Container>
  )
}
