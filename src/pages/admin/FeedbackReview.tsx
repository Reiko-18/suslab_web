import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import DeleteIcon from '@mui/icons-material/Delete'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import type { SelectChangeEvent } from '@mui/material/Select'

const CATEGORY_TABS = ['all', 'feature', 'event', 'bug'] as const
const STATUS_COLORS: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
  open: 'info', reviewed: 'warning', accepted: 'success', rejected: 'error',
}
const CATEGORY_COLORS: Record<string, 'primary' | 'secondary' | 'error'> = {
  feature: 'primary', event: 'secondary', bug: 'error',
}

export default function FeedbackReview() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categoryTab, setCategoryTab] = useState(0)

  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    let cancelled = false
    const category = CATEGORY_TABS[categoryTab]
    const controller = new AbortController()
    edgeFunctions.listFeedbacks({ category: category === 'all' ? undefined : category })
      .then((data: any) => { if (!cancelled) { setFeedbacks(data?.feedbacks ?? []); setLoading(false) } })
      .catch((err: any) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true; controller.abort() }
  }, [categoryTab])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await edgeFunctions.updateFeedbackStatus(id, newStatus)
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)))
      setNotice(t('admin.feedbackReview.statusUpdated'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('feedback.confirmDelete'))) return
    try {
      await edgeFunctions.deleteFeedback(id)
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      setNotice(t('feedback.deleted'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.feedbackReview.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.feedbackReview.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={categoryTab} onChange={(_, v: number) => setCategoryTab(v)} sx={{ mb: 2 }}>
        {CATEGORY_TABS.map((c) => (
          <Tab key={c} label={c === 'all' ? t('feedback.all') : t(`feedback.${c}`)} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('feedback.titleLabel')}</TableCell>
                <TableCell>{t('feedback.categoryLabel')}</TableCell>
                <TableCell><ThumbUpIcon fontSize="small" /></TableCell>
                <TableCell>{t('admin.feedbackReview.currentStatus')}</TableCell>
                <TableCell>{t('feedback.changeStatus')}</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {feedbacks.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.content}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`feedback.${f.category}`)} size="small" color={CATEGORY_COLORS[f.category] ?? 'default'} />
                  </TableCell>
                  <TableCell>{f.vote_count ?? 0}</TableCell>
                  <TableCell>
                    <Chip label={t(`feedback.status.${f.status}`)} size="small" color={STATUS_COLORS[f.status]} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={f.status}
                      size="small"
                      onChange={(e: SelectChangeEvent<string>) => handleStatusChange(f.id, e.target.value)}
                    >
                      {['open', 'reviewed', 'accepted', 'rejected'].map((s) => (
                        <MenuItem key={s} value={s}>{t(`feedback.status.${s}`)}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => handleDelete(f.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {feedbacks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} align="center">
                    <Typography color="text.secondary">{t('feedback.empty')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
