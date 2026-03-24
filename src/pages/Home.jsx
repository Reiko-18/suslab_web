import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import HeadphonesIcon from '@mui/icons-material/Headphones'
import FavoriteIcon from '@mui/icons-material/Favorite'
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import BrushIcon from '@mui/icons-material/Brush'
import CodeIcon from '@mui/icons-material/Code'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'

const STAT_CARDS = [
  { key: 'messages', label: 'home.stats.messages', icon: ChatBubbleIcon, iconColor: '#7C9070', badgeBg: '#7C907015', badgeColor: '#4A5D43', change: '+12%' },
  { key: 'vcHours', label: 'home.stats.vcHours', icon: HeadphonesIcon, iconColor: '#5B9BD5', badgeBg: '#5B9BD515', badgeColor: '#5B9BD5', change: '+8%' },
  { key: 'friends', label: 'home.stats.friends', icon: FavoriteIcon, iconColor: '#D4845E', badgeBg: '#D4845E15', badgeColor: '#D4845E', change: '+3 this month' },
  { key: 'level', label: 'home.stats.level', icon: MilitaryTechIcon, iconColor: '#9B8AA8', badgeBg: '#9B8AA815', badgeColor: '#9B8AA8' },
]

const BADGES = [
  { icon: LocalFireDepartmentIcon, bg: '#D4845E15', color: '#D4845E' },
  { icon: MusicNoteIcon, bg: '#5B9BD515', color: '#5B9BD5' },
  { icon: CodeIcon, bg: '#9B8AA815', color: '#9B8AA8' },
  { icon: BrushIcon, bg: '#F0EFEC', color: '#8E8E93' },
  { icon: SportsEsportsIcon, bg: '#7C907015', color: '#7C9070' },
]

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [level, setLevel] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAnn, setLoadingAnn] = useState(true)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || meta.name || 'User'

  useEffect(() => {
    edgeFunctions.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false))

    edgeFunctions.listAnnouncements({ page: 1, pageSize: 3 })
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnn(false))

    edgeFunctions.getMyLevel()
      .then(setLevel)
      .catch(() => {})
  }, [])

  const xp = level?.xp ?? 0
  const lvl = level?.level ?? 1
  const xpNext = lvl * lvl * 10
  const xpProgress = xpNext > 0 ? Math.min((xp / xpNext) * 100, 100) : 0

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#8E8E93' }}>
          {t('home.welcomeBack')}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 500, color: '#2D2D2D', fontFamily: 'serif', letterSpacing: -1 }}>
          {displayName}
        </Typography>
      </Box>

      {/* Stats Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {STAT_CARDS.map(({ key, label, icon: Icon, iconColor, badgeBg, badgeColor, change }) => (
          <Card key={key} sx={{ p: 2.5, borderRadius: 4, boxShadow: '0 4px 30px #00000006' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8E8E93' }}>
                {t(label)}
              </Typography>
              <Icon sx={{ fontSize: 18, color: iconColor }} />
            </Box>
            {loadingStats && key !== 'level' ? (
              <Skeleton variant="text" width={80} sx={{ fontSize: '2rem' }} />
            ) : key === 'level' ? (
              <>
                <Typography sx={{ fontSize: 32, fontWeight: 500, color: '#2D2D2D', fontFamily: 'serif', letterSpacing: -1 }}>
                  Lv. {lvl}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={xpProgress}
                    sx={{
                      height: 6, borderRadius: 3, bgcolor: '#F0EFEC',
                      '& .MuiLinearProgress-bar': { bgcolor: '#9B8AA8', borderRadius: 3 },
                    }}
                  />
                  <Typography sx={{ fontSize: 10, fontWeight: 500, color: '#8E8E93', mt: 0.5 }}>
                    {xp} / {xpNext} XP
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 32, fontWeight: 500, color: '#2D2D2D', fontFamily: 'serif', letterSpacing: -1 }}>
                  {key === 'messages' ? (stats?.memberCount ?? 0) : key === 'vcHours' ? '—' : (stats?.eventCount ?? 0)}
                </Typography>
                {change && (
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1.2, py: 0.4, borderRadius: 1.5, bgcolor: badgeBg, mt: 0.5,
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 12, color: badgeColor }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 500, color: badgeColor, fontFamily: 'monospace' }}>
                      {change}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Card>
        ))}
      </Box>

      {/* Bottom Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Badges */}
        <Card sx={{ p: 2.5, borderRadius: 4, boxShadow: '0 4px 30px #00000006' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 500, color: '#2D2D2D', fontFamily: 'serif' }}>
              {t('home.badges')}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#8E8E93' }}>
              {level?.badges?.length ?? 0} {t('home.earned')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {BADGES.map(({ icon: BadgeIcon, bg, color }, i) => (
              <Box key={i} sx={{
                width: 48, height: 48, borderRadius: 3, bgcolor: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BadgeIcon sx={{ fontSize: 24, color }} />
              </Box>
            ))}
          </Box>
        </Card>

        {/* Latest Announcements */}
        <Card sx={{ p: 2.5, borderRadius: 4, boxShadow: '0 4px 30px #00000006' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 500, color: '#2D2D2D', fontFamily: 'serif' }}>
              {t('home.latestAnnouncements')}
            </Typography>
            <Button size="small" onClick={() => navigate('/announcements')} sx={{ fontSize: 12, color: '#8E8E93' }}>
              {t('home.viewAll')}
            </Button>
          </Box>
          {loadingAnn ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="text" height={36} />)}
            </Box>
          ) : announcements.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#8E8E93', py: 2 }}>
              {t('announcements.empty')}
            </Typography>
          ) : (
            <List disablePadding>
              {announcements.map((ann) => (
                <ListItem key={ann.id} disablePadding>
                  <ListItemButton onClick={() => navigate('/announcements')} sx={{ borderRadius: 2, py: 0.5 }}>
                    <ListItemText
                      primary={ann.title}
                      secondary={new Date(ann.created_at).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: '#2D2D2D' }}
                      secondaryTypographyProps={{ fontSize: 11, color: '#8E8E93' }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Card>
      </Box>
    </Box>
  )
}
