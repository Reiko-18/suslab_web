/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Select, Button, Alert } from '../ui'

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
    <Dialog
      open={open}
      onClose={onClose}
      title={t('admin.tickets.create')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={loading || !title.trim() || !content.trim()}>
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
          label={t('admin.tickets.titleLabel')}
          fullWidth
          value={title}
          onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
        />

        <TextField
          label={t('admin.tickets.contentLabel')}
          fullWidth
          multiline
          rows={4}
          value={content}
          onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
        />

        <div css={css`display: flex; gap: var(--spacing-3);`}>
          <Select
            label={t('admin.tickets.categoryLabel')}
            value={category}
            onChange={(value) => setCategory(value as TicketCategory)}
            options={(['general', 'bug', 'request', 'report'] as TicketCategory[]).map((c) => ({
              value: c,
              label: t(`admin.tickets.category.${c}`),
            }))}
            fullWidth
          />
          <Select
            label={t('admin.tickets.priorityLabel')}
            value={priority}
            onChange={(value) => setPriority(value as TicketPriority)}
            options={(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((p) => ({
              value: p,
              label: t(`admin.tickets.priority.${p}`),
            }))}
            fullWidth
          />
        </div>
      </div>
    </Dialog>
  )
}
