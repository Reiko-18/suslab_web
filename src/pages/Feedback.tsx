/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { useActiveServer } from '../hooks/useActiveServer'
import { Icon, Button, Card, Chip, Skeleton, Snackbar } from '../components/ui'
import { Container, Stack } from '../components/layout'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackDialog from '../components/FeedbackDialog'

const CATEGORIES = ['all', 'feature', 'event', 'bug'] as const
type Category = typeof CATEGORIES[number]

interface SnackState {
  severity: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export default function Feedback() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const serverId = useActiveServer()
  const isModerator: boolean = hasRole('moderator')
  const [category, setCategory] = useState<Category>('all')
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [snack, setSnack] = useState<SnackState | null>(null)

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = { pageSize: 50, server_id: serverId }
      if (category !== 'all') params.category = category
      const data = await edgeFunctions.listFeedbacks(params) as { feedbacks?: any[] }
      setFeedbacks(data.feedbacks ?? [])
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [category, serverId])

  useEffect(() => { loadFeedbacks() }, [loadFeedbacks])

  const handleVote = async (feedbackId: string) => {
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === feedbackId
          ? {
              ...f,
              has_voted: !f.has_voted,
              vote_count: f.has_voted ? f.vote_count - 1 : f.vote_count + 1,
            }
          : f
      )
    )

    try {
      await edgeFunctions.voteFeedback(feedbackId)
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
      loadFeedbacks()
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, status, serverId)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id, serverId)
      setSnack({ severity: 'success', message: t('feedback.deleted') })
      loadFeedbacks()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCreate = async (data: any) => {
    try {
      await edgeFunctions.createFeedback({ ...data, server_id: serverId })
      setSnack({ severity: 'success', message: t('feedback.created') })
      loadFeedbacks()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  return (
    <Container maxWidth="md" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>{t('feedback.title')}</h1>

      <div css={css({ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' })}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={t(`feedback.${cat}`)}
            onClick={() => setCategory(cat)}
            variant={category === cat ? 'filled' : 'outlined'}
          />
        ))}
      </div>

      {loading ? (
        <Stack gap={16}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={120} />)}
        </Stack>
      ) : feedbacks.length === 0 ? (
        <Card css={css({ padding: 32, textAlign: 'center' })}>
          <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('feedback.empty')}</p>
        </Card>
      ) : (
        <Stack gap={0}>
          {feedbacks.map((fb) => (
            <FeedbackCard
              key={fb.id}
              feedback={fb}
              userId={user?.id ?? ''}
              isModerator={isModerator}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      <Button variant="fab" onClick={() => setShowCreate(true)} aria-label={t('feedback.create')}>
        <Icon name="add" />
      </Button>

      <FeedbackDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        message={snack?.message ?? ''}
      />
    </Container>
  )
}
