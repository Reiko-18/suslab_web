import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'

export default function AnnouncementDialog({ open, onClose, announcement, onSave }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = !!announcement

  useEffect(() => {
    if (open) {
      if (announcement) {
        setTitle(announcement.title ?? '')
        setContent(announcement.content ?? '')
        setPinned(announcement.pinned ?? false)
      } else {
        setTitle('')
        setContent('')
        setPinned(false)
      }
    }
  }, [open, announcement])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ title, content, pinned }, announcement?.id)
      onClose()
    } catch (err) {
      console.error('Failed to save announcement:', err)
    } finally {
      setSaving(false)
    }
  }

  const isValid = title.trim().length >= 1 && title.length <= 200 && content.trim().length >= 1 && content.length <= 5000

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEdit ? t('announcements.edit') : t('announcements.create')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label={t('announcements.titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          inputProps={{ maxLength: 200 }}
          helperText={`${title.length}/200`}
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
          label={t('announcements.contentLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          inputProps={{ maxLength: 5000 }}
          helperText={`${content.length}/5000`}
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          control={
            <Switch checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          }
          label={t('announcements.pinnedLabel')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isValid || saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {t('announcements.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
