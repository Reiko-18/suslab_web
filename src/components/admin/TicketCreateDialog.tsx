import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'

type TicketCategory = 'general' | 'bug' | 'request' | 'report'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

interface CreatePayload {
  title: string
  content: string
  category: TicketCategory
  priority: TicketPriority
}

interface TicketCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (payload: CreatePayload) => Promise<void>
}

export default function TicketCreateDialog({ open, onClose, onCreated }: TicketCreateDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<TicketCategory>('general')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onCreated({ title: title.trim(), content: content.trim(), category, priority })
      setTitle('')
      setContent('')
      setCategory('general')
      setPriority('normal')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('admin.tickets.create')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.tickets.titleLabel')}
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />

        <TextField
          label={t('admin.tickets.contentLabel')}
          fullWidth
          multiline
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>{t('admin.tickets.categoryLabel')}</InputLabel>
            <Select
              value={category}
              label={t('admin.tickets.categoryLabel')}
              onChange={(e: SelectChangeEvent<TicketCategory>) => setCategory(e.target.value as TicketCategory)}
            >
              {(['general', 'bug', 'request', 'report'] as TicketCategory[]).map((c) => (
                <MenuItem key={c} value={c}>{t(`admin.tickets.category.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t('admin.tickets.priorityLabel')}</InputLabel>
            <Select
              value={priority}
              label={t('admin.tickets.priorityLabel')}
              onChange={(e: SelectChangeEvent<TicketPriority>) => setPriority(e.target.value as TicketPriority)}
            >
              {(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((p) => (
                <MenuItem key={p} value={p}>{t(`admin.tickets.priority.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleCreate} variant="contained" disabled={loading || !title.trim() || !content.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
