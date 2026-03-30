/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Button, Alert } from '../ui'

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
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t('admin.roles.edit') : t('admin.roles.create')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSave} disabled={loading || !name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && (
        <div css={css`margin-bottom: var(--spacing-3);`}>
          <Alert severity="error">{error}</Alert>
        </div>
      )}

      <div css={css`display: flex; flex-direction: column; gap: var(--spacing-3);`}>
        <TextField
          label={t('admin.roles.name')}
          fullWidth
          value={name}
          onChange={(e) => setName((e.target as HTMLInputElement).value)}
        />

        <div css={css`display: flex; align-items: center; gap: var(--spacing-3);`}>
          <TextField
            label={t('admin.roles.color')}
            value={color}
            onChange={(e) => setColor((e.target as HTMLInputElement).value)}
            fullWidth
          />
          <label
            css={css`
              width: 40px;
              height: 40px;
              border-radius: 4px;
              background: ${color};
              border: 1px solid var(--color-divider);
              cursor: pointer;
              flex-shrink: 0;
              display: block;
              position: relative;
              overflow: hidden;
            `}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              css={css`opacity: 0; width: 0; height: 0; position: absolute;`}
            />
          </label>
        </div>

        <TextField
          label={t('admin.roles.position')}
          type="number"
          fullWidth
          value={String(position)}
          onChange={(e) => setPosition(Number((e.target as HTMLInputElement).value))}
        />
      </div>
    </Dialog>
  )
}
