// src/components/admin/UserActionDialog.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

const TIMEOUT_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 hour' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: '7 days' },
]

export default function UserActionDialog({ open, onClose, actionType, targetUser, onConfirm }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm({
        actionType,
        userId: targetUser.id,
        reason,
        durationMinutes: duration,
      })
      setReason('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const titleMap = {
    ban: t('admin.users.actions.ban'),
    kick: t('admin.users.actions.kick'),
    timeout: t('admin.users.actions.timeout'),
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titleMap[actionType] ?? actionType}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {t('admin.users.actions.confirmTarget', { name: targetUser?.display_name ?? '' })}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.users.actions.reason')}
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mb: 2 }}
        />

        {actionType === 'timeout' && (
          <FormControl fullWidth>
            <InputLabel>{t('admin.users.actions.duration')}</InputLabel>
            <Select
              value={duration}
              label={t('admin.users.actions.duration')}
              onChange={(e) => setDuration(e.target.value)}
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
