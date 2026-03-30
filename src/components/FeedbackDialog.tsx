/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Select, Button } from './ui'
import { Stack } from './layout'

interface FeedbackPayload {
  category: string
  title: string
  content: string
}

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (payload: FeedbackPayload) => void
}

export default function FeedbackDialog({ open, onClose, onCreate }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState('feature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return
    onCreate({ category, title: title.trim(), content: content.trim() })
    setTitle('')
    setContent('')
    setCategory('feature')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('feedback.create')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!title.trim() || !content.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Stack gap="var(--spacing-3)">
        <Select
          label={t('feedback.categoryLabel')}
          value={category}
          onChange={(value) => setCategory(value)}
          options={[
            { value: 'feature', label: t('feedback.feature') },
            { value: 'event', label: t('feedback.event') },
            { value: 'bug', label: t('feedback.bug') },
          ]}
          fullWidth
        />
        <TextField
          label={t('feedback.titleLabel')}
          value={title}
          onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
          fullWidth
        />
        <TextField
          label={t('feedback.contentLabel')}
          value={content}
          onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
          fullWidth
          multiline
          rows={4}
        />
      </Stack>
    </Dialog>
  )
}
