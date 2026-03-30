/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, TextField, Switch, Button, CircularProgress } from './ui'

interface AnnouncementPayload {
  title: string
  content: string
  pinned: boolean
}

interface Announcement {
  id: string
  title?: string
  content?: string
  pinned?: boolean
}

interface AnnouncementDialogProps {
  open: boolean
  onClose: () => void
  announcement?: Announcement | null
  onSave: (payload: AnnouncementPayload, id?: string) => Promise<void>
}

export default function AnnouncementDialog({ open, onClose, announcement, onSave }: AnnouncementDialogProps) {
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
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t('announcements.edit') : t('announcements.create')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isValid || saving}
            startIcon={saving ? undefined : undefined}
          >
            {saving && (
              <CircularProgress size={18} color="var(--color-on-primary)" />
            )}
            {t('announcements.save')}
          </Button>
        </>
      }
    >
      <div css={css`display: flex; flex-direction: column; gap: var(--spacing-3);`}>
        <TextField
          fullWidth
          label={t('announcements.titleLabel')}
          value={title}
          onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
          helperText={`${title.length}/200`}
        />
        <TextField
          fullWidth
          multiline
          rows={4}
          label={t('announcements.contentLabel')}
          value={content}
          onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
          helperText={`${content.length}/5000`}
        />
        <Switch
          checked={pinned}
          onChange={(checked) => setPinned(checked)}
          label={t('announcements.pinnedLabel')}
        />
      </div>
    </Dialog>
  )
}
