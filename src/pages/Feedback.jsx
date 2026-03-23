import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Fab from '@mui/material/Fab'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackDialog from '../components/FeedbackDialog'

const CATEGORIES = ['all', 'feature', 'event', 'bug']

export default function Feedback() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const isModerator = hasRole('moderator')
  const [category, setCategory] = useState('all')
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [snack, setSnack] = useState(null)

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      const params = { pageSize: 50 }
      if (category !== 'all') params.category = category
      const data = await edgeFunctions.listFeedbacks(params)
      setFeedbacks(data.feedbacks ?? [])
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { loadFeedbacks() }, [loadFeedbacks])

  const handleVote = async (feedbackId) => {
    // Optimistic update
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
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
      loadFeedbacks() // Revert on error
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, status)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id)
      setSnack({ severity: 'success', message: t('feedback.deleted') })
      loadFeedbacks()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCreate = async (data) => {
    try {
      await edgeFunctions.createFeedback(data)
      setSnack({ severity: 'success', message: t('feedback.created') })
      loadFeedbacks()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('feedback.title')}</Typography>

      {/* Category filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={t(`feedback.${cat}`)}
            onClick={() => setCategory(cat)}
            color={category === cat ? 'primary' : 'default'}
            variant={category === cat ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={120} />)}
        </Stack>
      ) : feedbacks.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('feedback.empty')}</Typography>
        </Card>
      ) : (
        <Stack>
          {feedbacks.map((fb) => (
            <FeedbackCard
              key={fb.id}
              feedback={fb}
              userId={user?.id}
              isModerator={isModerator}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setShowCreate(true)}
      >
        <AddIcon />
      </Fab>

      <FeedbackDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
