/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Card, Chip, Icon, Avatar, Button, Select } from './ui'

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  feature: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  event: { bg: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' },
  bug: { bg: 'var(--color-error)', color: '#fff' },
}

const STATUS_LIST = ['open', 'reviewed', 'accepted', 'rejected']

interface Feedback {
  id: string
  author_id: string
  author_display_name?: string
  author_avatar_url?: string
  category: string
  status: string
  title: string
  content: string
  vote_count: number
  has_voted: boolean
  created_at: string
}

interface FeedbackCardProps {
  feedback: Feedback
  userId: string
  isModerator: boolean
  onVote: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

export default function FeedbackCard({ feedback, userId, isModerator, onVote, onStatusChange, onDelete }: FeedbackCardProps) {
  const { t } = useTranslation()
  const isAuthor = feedback.author_id === userId
  const categoryStyle = CATEGORY_COLORS[feedback.category] || { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }

  return (
    <Card css={css`margin-bottom: var(--spacing-3);`}>
      {/* 分類 + 狀態標籤 */}
      <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;`}>
        <Chip
          label={t(`feedback.${feedback.category}`)}
          size="small"
          bg={categoryStyle.bg}
          color={categoryStyle.color}
        />
        <Chip label={t(`feedback.status.${feedback.status}`)} size="small" variant="outlined" />
      </div>

      {/* 標題 */}
      <h3 css={css`font-size: 18px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
        {feedback.title}
      </h3>

      {/* 內容 */}
      <p
        css={css`
          font-size: 13px;
          color: var(--color-on-surface-muted);
          margin: 0 0 16px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        `}
      >
        {feedback.content}
      </p>

      {/* 底部列 */}
      <div css={css`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;`}>
        {/* 作者 */}
        <div css={css`display: flex; align-items: center; gap: 8px;`}>
          <Avatar src={feedback.author_avatar_url} size={24} />
          <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>{feedback.author_display_name}</span>
          <span css={css`font-size: 12px; color: var(--color-on-surface-dim);`}>
            {new Date(feedback.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* 投票 + 操作 */}
        <div css={css`display: flex; align-items: center; gap: 8px;`}>
          <div css={css`display: flex; align-items: center;`}>
            <Button
              variant="icon"
              onClick={() => onVote(feedback.id)}
              css={css`color: ${feedback.has_voted ? 'var(--color-primary)' : 'var(--color-on-surface-muted)'};`}
            >
              <Icon name="thumb_up" size={18} />
            </Button>
            <span css={css`font-size: 13px; color: var(--color-on-surface);`}>
              {t('feedback.votes', { count: feedback.vote_count })}
            </span>
          </div>

          {isModerator && (
            <Select
              value={feedback.status}
              onChange={(value) => onStatusChange(feedback.id, value)}
              options={STATUS_LIST.map((s) => ({ value: s, label: t(`feedback.status.${s}`) }))}
            />
          )}

          {isAuthor && (
            <Button
              variant="icon"
              onClick={() => onDelete(feedback.id)}
              css={css`color: var(--color-error);`}
            >
              <Icon name="delete" size={18} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
