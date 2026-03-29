import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'

interface FeedbackPayload {
  category: string
  title: string
  content: string
}

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (payload: FeedbackPayload) => void
}

export default function FeedbackDialog({ open, onClose, onCreate }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState('feature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return
    onCreate({ category, title: title.trim(), content: content.trim() })
    setTitle('')
    setContent('')
    setCategory('feature')
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('feedback.create')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t('feedback.categoryLabel')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
          >
            <MenuItem value="feature">{t('feedback.feature')}</MenuItem>
            <MenuItem value="event">{t('feedback.event')}</MenuItem>
            <MenuItem value="bug">{t('feedback.bug')}</MenuItem>
          </TextField>
          <TextField
            label={t('feedback.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label={t('feedback.contentLabel')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            required
            multiline
            rows={4}
            inputProps={{ maxLength: 2000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || !content.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
