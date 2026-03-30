/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Card, Avatar, Chip, Icon, Button } from './ui'

interface Announcement {
  id: string
  title: string
  content: string
  pinned?: boolean
  created_at: string
  author_display_name?: string
  author_avatar_url?: string
}

interface AnnouncementCardProps {
  announcement: Announcement
  onEdit: (announcement: Announcement) => void
  onDelete: (announcement: Announcement) => void
  canManage?: boolean
  canDelete?: boolean
}

export default function AnnouncementCard({ announcement, onEdit, onDelete, canManage, canDelete }: AnnouncementCardProps) {
  const { t, i18n } = useTranslation()

  const timeAgo = new Date(announcement.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card css={css`margin-bottom: var(--spacing-3);`}>
      <div css={css`display: flex; align-items: flex-start; justify-content: space-between;`}>
        <div css={css`flex: 1; min-width: 0;`}>
          <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 8px;`}>
            <h3 css={css`font-size: 18px; font-weight: 600; color: var(--color-on-surface); margin: 0;`}>
              {announcement.title}
            </h3>
            {announcement.pinned && (
              <Chip
                icon="push_pin"
                label={t('announcements.pinned')}
                size="small"
                variant="outlined"
                color="var(--color-warning)"
                bg="var(--color-warning)"
              />
            )}
          </div>
          <p
            css={css`
              font-size: 14px;
              color: var(--color-on-surface);
              white-space: pre-wrap;
              margin: 0 0 16px 0;
            `}
          >
            {announcement.content}
          </p>
          <div css={css`display: flex; align-items: center; gap: 8px;`}>
            <Avatar
              src={announcement.author_avatar_url}
              size={24}
              fallback={(announcement.author_display_name || 'U')[0]?.toUpperCase()}
            />
            <span css={css`font-size: 13px; color: var(--color-on-surface-muted);`}>
              {announcement.author_display_name}
            </span>
            <span css={css`font-size: 13px; color: var(--color-on-surface-muted);`}>
              {timeAgo}
            </span>
          </div>
        </div>
        {(canManage || canDelete) && (
          <div css={css`display: flex; gap: 4px; margin-left: 8px; flex-shrink: 0;`}>
            {canManage && (
              <Button variant="icon" onClick={() => onEdit(announcement)} title={t('announcements.edit')}>
                <Icon name="edit" size={18} />
              </Button>
            )}
            {canDelete && (
              <Button variant="icon" onClick={() => onDelete(announcement)} title={t('announcements.delete')}>
                <Icon name="delete" size={18} />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
