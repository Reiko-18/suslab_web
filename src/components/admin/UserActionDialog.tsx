/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Select, Button, Alert } from '../ui'

type ActionType = 'ban' | 'kick' | 'timeout'

interface TargetUser {
  id: string
  display_name?: string
}

interface ConfirmPayload {
  actionType: ActionType
  userId: string
  reason: string
  durationMinutes: number
}

interface UserActionDialogProps {
  open: boolean
  onClose: () => void
  actionType: ActionType
  targetUser: TargetUser
  onConfirm: (payload: ConfirmPayload) => Promise<void>
}

const TIMEOUT_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '60', label: '1 hour' },
  { value: '1440', label: '24 hours' },
  { value: '10080', label: '7 days' },
]

export default function UserActionDialog({ open, onClose, actionType, targetUser, onConfirm }: UserActionDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('60')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm({
        actionType,
        userId: targetUser.id,
        reason,
        durationMinutes: Number(duration),
      })
      setReason('')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const titleMap: Record<ActionType, string> = {
    ban: t('admin.users.actions.ban'),
    kick: t('admin.users.actions.kick'),
    timeout: t('admin.users.actions.timeout'),
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titleMap[actionType] ?? actionType}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading}
            css={css`background: var(--color-error); &:hover:not(:disabled) { opacity: 0.9; }`}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <p css={css`font-size: 14px; color: var(--color-on-surface); margin: 0 0 var(--spacing-3) 0;`}>
        {t('admin.users.actions.confirmTarget', { name: targetUser?.display_name ?? '' })}
      </p>

      {error && (
        <div css={css`margin-bottom: var(--spacing-3);`}>
          <Alert severity="error">{error}</Alert>
        </div>
      )}

      <div css={css`display: flex; flex-direction: column; gap: var(--spacing-3);`}>
        <TextField
          label={t('admin.users.actions.reason')}
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
        />

        {actionType === 'timeout' && (
          <Select
            label={t('admin.users.actions.duration')}
            value={duration}
            onChange={(value) => setDuration(value)}
            options={TIMEOUT_OPTIONS}
            fullWidth
          />
        )}
      </div>
    </Dialog>
  )
}
