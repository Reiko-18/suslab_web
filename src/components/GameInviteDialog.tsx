/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Select, Button } from './ui'
import { Stack } from './layout'

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
    <Dialog
      open={open}
      onClose={onClose}
      title={t('games.invites.create')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!title.trim()}>
            {t('games.invites.create')}
          </Button>
        </>
      }
    >
      <Stack gap="var(--spacing-3)">
        <Select
          label={t('games.invites.gameType')}
          value={gameType}
          onChange={(value) => setGameType(value)}
          options={[
            { value: '2048', label: '2048' },
            { value: 'external', label: t('games.invites.external') },
          ]}
          fullWidth
        />
        <TextField
          label={t('games.invites.titleLabel')}
          value={title}
          onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
          fullWidth
        />
        <TextField
          label={t('games.invites.description')}
          value={description}
          onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          fullWidth
          multiline
          rows={2}
        />
        <TextField
          label={t('games.invites.maxPlayers')}
          type="number"
          value={String(maxPlayers)}
          onChange={(e) => setMaxPlayers(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
          fullWidth
        />
      </Stack>
    </Dialog>
  )
}
