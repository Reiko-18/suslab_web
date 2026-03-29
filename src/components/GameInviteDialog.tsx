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

interface GameInvitePayload {
  game_type: string
  title: string
  description?: string
  max_players: number
}

interface GameInviteDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (payload: GameInvitePayload) => void
}

export default function GameInviteDialog({ open, onClose, onCreate }: GameInviteDialogProps) {
  const { t } = useTranslation()
  const [gameType, setGameType] = useState('2048')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)

  const handleCreate = () => {
    if (!title.trim()) return
    onCreate({
      game_type: gameType,
      title: title.trim(),
      description: description.trim() || undefined,
      max_players: maxPlayers,
    })
    setTitle('')
    setDescription('')
    setGameType('2048')
    setMaxPlayers(4)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('games.invites.create')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label={t('games.invites.gameType')}
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
            fullWidth
          >
            <MenuItem value="2048">2048</MenuItem>
            <MenuItem value="external">{t('games.invites.external')}</MenuItem>
          </TextField>
          <TextField
            label={t('games.invites.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label={t('games.invites.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            label={t('games.invites.maxPlayers')}
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Math.max(1, parseInt(e.target.value) || 1))}
            fullWidth
            inputProps={{ min: 1 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!title.trim()}>
          {t('games.invites.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
