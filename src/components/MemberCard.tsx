/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Avatar, Chip } from './ui'

interface RoleStyle {
  bg: string
  color: string
  border: string
}

const ROLE_COLORS: Record<string, RoleStyle> = {
  admin: { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
  moderator: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  member: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
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

interface MemberCardProps {
  member: Member
  onClick: () => void
}

export default function MemberCard({ member, onClick }: MemberCardProps) {
  const { t } = useTranslation()

  const MAX_TAGS = 2
  const tags = member.skill_tags ?? []
  const visibleTags = tags.slice(0, MAX_TAGS)
  const extraCount = tags.length - MAX_TAGS
  const roleStyle = (member.role && ROLE_COLORS[member.role]) || ROLE_COLORS.member

  return (
    <div
      onClick={onClick}
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        border: 1px solid var(--color-divider);
        background: var(--color-surface);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
          border-color: var(--color-primary);
        }
      `}
    >
      <div
        css={css`
          text-align: center;
          flex-grow: 1;
          padding: 24px 16px;
        `}
      >
        <div css={css`display: flex; justify-content: center; margin-bottom: 16px;`}>
          <Avatar
            src={member.avatar_url}
            size={72}
            fallback={(member.display_name || 'U')[0]?.toUpperCase()}
          />
        </div>
        <p
          css={css`
            font-weight: 700;
            font-size: 15px;
            margin: 0 0 4px 0;
            color: var(--color-on-surface);
          `}
        >
          {member.display_name}
        </p>
        {member.role && (
          <div css={css`margin-top: 4px;`}>
            <Chip
              label={t(`profile.roles.${member.role}`)}
              size="small"
              bg={roleStyle.bg}
              color={roleStyle.color}
            />
          </div>
        )}
        {member.bio && (
          <p
            css={css`
              margin: 12px 0 0;
              font-size: 12px;
              line-height: 1.5;
              color: var(--color-on-surface-muted);
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            `}
          >
            {member.bio}
          </p>
        )}
        {visibleTags.length > 0 && (
          <div
            css={css`
              margin-top: 12px;
              display: flex;
              justify-content: center;
              flex-wrap: wrap;
              gap: 4px;
            `}
          >
            {visibleTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                bg="var(--color-surface-container)"
              />
            ))}
            {extraCount > 0 && (
              <Chip
                label={t('members.skillsMore', { count: extraCount })}
                size="small"
                bg="var(--color-surface-container)"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
