import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'

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
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>{t('levels.title')}</Typography>
          </Box>
          <Button
            size="small"
            startIcon={<LeaderboardIcon />}
            onClick={onLeaderboard}
          >
            {t('levels.leaderboard')}
          </Button>
        </Box>

        <Typography variant="subtitle1" fontWeight={600}>
          {t('levels.level', { level })}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
            {t('levels.xp', { current: xp, next: nextLevelMinXp })}
          </Typography>
        </Box>

        {badges && badges.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{t('levels.badges')}:</Typography>
            {badges.map((badge) => (
              <Chip key={badge} label={badge} size="small" variant="outlined" />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">{t('levels.noBadges')}</Typography>
        )}
      </CardContent>
    </Card>
  )
}
