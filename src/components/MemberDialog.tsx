/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { Dialog, Avatar, Chip, TextField, Button, Icon, Divider, CircularProgress } from './ui'

const SOCIAL_ICONS: Record<string, string> = {
  twitter: 'x',
  github: 'github',
  youtube: 'youtube',
  pixiv: 'brush',
  other: 'link',
}

interface Comment {
  id: string
  content: string
  author_display_name: string
  author_avatar_url?: string
  created_at: string
}

interface Member {
  user_id?: string
  display_name?: string
  avatar_url?: string
  role?: string
  bio?: string
  skill_tags?: string[]
  social_links?: Record<string, string>
  created_at?: string
}

interface MemberDialogProps {
  member: Member | null
  open: boolean
  onClose: () => void
}

export default function MemberDialog({ member, open, onClose }: MemberDialogProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [posting, setPosting] = useState(false)

  const isProfileOwner = user?.id === member?.user_id

  const loadComments = useCallback(async () => {
    if (!member?.user_id) return
    setLoadingComments(true)
    try {
      const result = await edgeFunctions.listComments(member.user_id) as { comments?: Comment[] }
      setComments(result.comments ?? [])
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setLoadingComments(false)
    }
  }, [member?.user_id])

  useEffect(() => {
    if (open && member?.user_id) {
      loadComments()
    }
    if (!open) {
      setComments([])
      setCommentText('')
    }
  }, [open, member?.user_id, loadComments])

  const handlePostComment = async () => {
    if (!commentText.trim() || !member?.user_id) return
    setPosting(true)
    try {
      await edgeFunctions.createComment(member.user_id, commentText.trim())
      setCommentText('')
      await loadComments()
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPosting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await edgeFunctions.deleteComment(commentId)
      await loadComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  if (!member) return null

  const socialLinks = member.social_links ?? {}
  const joinDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <Dialog open={open} onClose={onClose} title="" maxWidth={560}>
      {/* 頭像 + 名稱 */}
      <div css={css`text-align: center; margin-bottom: var(--spacing-4);`}>
        <div css={css`display: flex; justify-content: center; margin-bottom: 8px;`}>
          <Avatar
            src={member.avatar_url}
            size={80}
            fallback={(member.display_name || 'U')[0]?.toUpperCase()}
          />
        </div>
        <h2 css={css`font-size: 20px; font-weight: 700; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
          {member.display_name}
        </h2>
        {member.role && (
          <Chip label={t(`profile.roles.${member.role}`)} size="small" bg="var(--color-primary)" color="var(--color-on-primary)" />
        )}
        {joinDate && (
          <p css={css`font-size: 13px; color: var(--color-on-surface-muted); margin: 4px 0 0 0;`}>
            {t('profile.joinDate')}: {joinDate}
          </p>
        )}
      </div>

      {/* Bio */}
      {member.bio && (
        <div css={css`margin-top: var(--spacing-3);`}>
          <p css={css`font-size: 14px; color: var(--color-on-surface); margin: 0;`}>{member.bio}</p>
        </div>
      )}

      {/* 技能標籤 */}
      {(member.skill_tags ?? []).length > 0 && (
        <div css={css`margin-top: var(--spacing-3);`}>
          <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
            {t('profile.skillTags')}
          </p>
          <div css={css`display: flex; flex-wrap: wrap; gap: 4px;`}>
            {member.skill_tags!.map((tag) => (
              <Chip key={tag} label={tag} size="small" />
            ))}
          </div>
        </div>
      )}

      {/* 社交連結 */}
      {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 && (
        <div css={css`margin-top: var(--spacing-3);`}>
          <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
            {t('members.socialLinks')}
          </p>
          <div css={css`display: flex; gap: 8px;`}>
            {Object.entries(socialLinks)
              .filter(([, url]) => url)
              .map(([platform, url]) => {
                const iconName = SOCIAL_ICONS[platform] || 'link'
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      width: 36px;
                      height: 36px;
                      border-radius: var(--radius-full);
                      color: var(--color-on-surface-muted);
                      transition: background 0.15s;
                      &:hover { background: var(--color-surface-container); }
                    `}
                  >
                    <Icon name={iconName} size={20} />
                  </a>
                )
              })}
          </div>
        </div>
      )}

      <Divider spacing="var(--spacing-4)" />

      {/* 留言牆 */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 8px 0;`}>
        {t('members.commentWall')}
      </p>

      {loadingComments ? (
        <div css={css`display: flex; justify-content: center; padding: var(--spacing-3) 0;`}>
          <CircularProgress size={24} />
        </div>
      ) : comments.length === 0 ? (
        <p css={css`font-size: 13px; color: var(--color-on-surface-muted); margin: 0; padding: 8px 0;`}>
          {t('members.noComments')}
        </p>
      ) : (
        <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              css={css`
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 4px 0;
              `}
            >
              <Avatar
                src={comment.author_avatar_url}
                size={28}
                fallback={(comment.author_display_name || 'U')[0]?.toUpperCase()}
              />
              <div css={css`flex: 1; min-width: 0;`}>
                <p css={css`font-size: 14px; color: var(--color-on-surface); margin: 0;`}>
                  {comment.content}
                </p>
                <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>
                  {comment.author_display_name} — {new Date(comment.created_at).toLocaleDateString(i18n.language)}
                </span>
              </div>
              {isProfileOwner && (
                <button
                  type="button"
                  onClick={() => handleDeleteComment(comment.id)}
                  title={t('members.deleteComment')}
                  css={css`
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    color: var(--color-on-surface-muted);
                    border-radius: var(--radius-full);
                    flex-shrink: 0;
                    &:hover { background: var(--color-surface-container); }
                  `}
                >
                  <Icon name="delete" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 留言輸入 */}
      <div css={css`display: flex; gap: 8px; margin-top: 8px;`}>
        <TextField
          fullWidth
          placeholder={t('members.writeComment')}
          value={commentText}
          onChange={(e) => setCommentText((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handlePostComment()
            }
          }}
        />
        <Button
          variant="primary"
          size="small"
          onClick={handlePostComment}
          disabled={!commentText.trim() || posting}
        >
          {t('members.postComment')}
        </Button>
      </div>
    </Dialog>
  )
}
