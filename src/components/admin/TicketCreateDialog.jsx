// src/components/admin/TicketCreateDialog.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'

export default function TicketCreateDialog({ open, onClose, onCreated }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      setError(err.message)
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
            <Select value={category} label={t('admin.tickets.categoryLabel')} onChange={(e) => setCategory(e.target.value)}>
              {['general', 'bug', 'request', 'report'].map((c) => (
                <MenuItem key={c} value={c}>{t(`admin.tickets.category.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t('admin.tickets.priorityLabel')}</InputLabel>
            <Select value={priority} label={t('admin.tickets.priorityLabel')} onChange={(e) => setPriority(e.target.value)}>
              {['low', 'normal', 'high', 'urgent'].map((p) => (
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
