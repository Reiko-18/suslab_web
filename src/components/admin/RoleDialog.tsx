import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'

interface Role {
  id?: string
  name: string
  color?: string
  position?: number
}

interface SavePayload {
  id?: string
  name: string
  color: string
  position: number
}

interface RoleDialogProps {
  open: boolean
  onClose: () => void
  role: Role | null
  onSave: (payload: SavePayload) => Promise<void>
}

export default function RoleDialog({ open, onClose, role, onSave }: RoleDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#99AAB5')
  const [position, setPosition] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(role)

  useEffect(() => {
    if (role) {
      setName(role.name)
      setColor(role.color ?? '#99AAB5')
      setPosition(role.position ?? 0)
    } else {
      setName('')
      setColor('#99AAB5')
      setPosition(0)
    }
  }, [role, open])

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave({ id: role?.id, name: name.trim(), color, position })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? t('admin.roles.edit') : t('admin.roles.create')}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label={t('admin.roles.name')}
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            label={t('admin.roles.color')}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: color,
              border: 1,
              borderColor: 'divider',
              cursor: 'pointer',
            }}
            component="label"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
          </Box>
        </Box>

        <TextField
          label={t('admin.roles.position')}
          type="number"
          fullWidth
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || !name.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
