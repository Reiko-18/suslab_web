/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Card, Chip, Avatar, Button, Icon } from './ui'

interface GameInvite {
  id: string
  host_id: string
  host_display_name?: string
  host_avatar_url?: string
  game_type: string
  title: string
  description?: string
  status: string
  is_participant: boolean
  participant_count: number
  max_players: number
}

interface GameInviteCardProps {
  invite: GameInvite
  userId: string
  onJoin: (id: string) => void
  onLeave: (id: string) => void
  onClose: (id: string) => void
}

export default function GameInviteCard({ invite, userId, onJoin, onLeave, onClose }: GameInviteCardProps) {
  const { t } = useTranslation()
  const isHost = invite.host_id === userId
  const isParticipant = invite.is_participant
  const isClosed = invite.status === 'closed'

  return (
    <Card
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
      `}
    >
      <div css={css`flex-grow: 1;`}>
        <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 8px;`}>
          <Chip label={invite.game_type} size="small" variant="outlined" bg="var(--color-primary)" color="var(--color-primary)" />
          {isClosed && <Chip label={t('games.invites.closed')} size="small" />}
        </div>
        <h3 css={css`font-size: 18px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
          {invite.title}
        </h3>
        {invite.description && (
          <p css={css`font-size: 13px; color: var(--color-on-surface-muted); margin: 0 0 8px 0;`}>
            {invite.description}
          </p>
        )}
        <div css={css`display: flex; align-items: center; gap: 4px; margin-bottom: 8px;`}>
          <Avatar src={invite.host_avatar_url} size={20} />
          <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>{invite.host_display_name}</span>
        </div>
        <div css={css`display: flex; align-items: center; gap: 4px;`}>
          <Icon name="group" size={18} style={{ color: 'var(--color-on-surface-dim)' }} />
          <span css={css`font-size: 13px; color: var(--color-on-surface);`}>
            {t('games.invites.players', { current: invite.participant_count, max: invite.max_players })}
          </span>
        </div>
      </div>
      <div css={css`display: flex; gap: 8px; margin-top: var(--spacing-3);`}>
        {!isClosed && !isHost && !isParticipant && (
          <Button size="small" variant="primary" onClick={() => onJoin(invite.id)}>
            {t('games.invites.join')}
          </Button>
        )}
        {!isClosed && isParticipant && !isHost && (
          <Button size="small" variant="secondary" onClick={() => onLeave(invite.id)}>
            {t('games.invites.leave')}
          </Button>
        )}
        {!isClosed && isHost && (
          <Button size="small" variant="secondary" onClick={() => onClose(invite.id)}>
            {t('games.invites.close')}
          </Button>
        )}
      </div>
    </Card>
  )
}
