/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Card, Chip, Button, Icon, LinearProgress } from './ui'

interface LevelCardProps {
  level: number
  xp: number
  badges?: string[]
  onLeaderboard: () => void
}

export default function LevelCard({ level, xp, badges, onLeaderboard }: LevelCardProps) {
  const { t } = useTranslation()

  const currentLevelMinXp = 10 * (level - 1) * (level - 1)
  const nextLevelMinXp = 10 * level * level
  const xpInLevel = xp - currentLevelMinXp
  const xpForLevel = nextLevelMinXp - currentLevelMinXp
  const progress = xpForLevel > 0 ? (xpInLevel / xpForLevel) * 100 : 0

  return (
    <Card css={css`margin-bottom: var(--spacing-4);`}>
      {/* 標題列 */}
      <div css={css`display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;`}>
        <div css={css`display: flex; align-items: center; gap: 8px;`}>
          <Icon name="emoji_events" size={22} style={{ color: 'var(--color-primary)' }} />
          <h3 css={css`font-size: 18px; font-weight: 700; color: var(--color-on-surface); margin: 0;`}>
            {t('levels.title')}
          </h3>
        </div>
        <Button size="small" variant="ghost" startIcon="leaderboard" onClick={onLeaderboard}>
          {t('levels.leaderboard')}
        </Button>
      </div>

      {/* 等級 */}
      <p css={css`font-size: 15px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 8px 0;`}>
        {t('levels.level', { level })}
      </p>

      {/* 經驗條 */}
      <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 8px;`}>
        <div css={css`flex-grow: 1;`}>
          <LinearProgress value={Math.min(progress, 100)} />
        </div>
        <span
          css={css`
            font-size: 12px;
            color: var(--color-on-surface-muted);
            min-width: 80px;
            text-align: right;
            white-space: nowrap;
          `}
        >
          {t('levels.xp', { current: xp, next: nextLevelMinXp })}
        </span>
      </div>

      {/* 徽章 */}
      {badges && badges.length > 0 ? (
        <div css={css`display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;`}>
          <span css={css`font-size: 12px; color: var(--color-on-surface-muted); margin-right: 4px;`}>
            {t('levels.badges')}:
          </span>
          {badges.map((badge) => (
            <Chip key={badge} label={badge} size="small" variant="outlined" />
          ))}
        </div>
      ) : (
        <span css={css`font-size: 12px; color: var(--color-on-surface-dim);`}>
          {t('levels.noBadges')}
        </span>
      )}
    </Card>
  )
}
