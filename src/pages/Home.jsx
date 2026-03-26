import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
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
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import DiamondIcon from '@mui/icons-material/Diamond'
import BugReportIcon from '@mui/icons-material/BugReport'
import ShieldIcon from '@mui/icons-material/Shield'
import VerifiedIcon from '@mui/icons-material/Verified'
import CodeIcon from '@mui/icons-material/Code'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import GroupsIcon from '@mui/icons-material/Groups'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

const STAT_CARDS = [
  { key: 'messages', label: 'home.stats.messages', icon: ChatBubbleIcon, iconColor: '#7C9070', badgeBg: '#7C907015', badgeColor: '#4A5D43', change: '+12%' },
  { key: 'vcHours', label: 'home.stats.vcHours', icon: HeadphonesIcon, iconColor: '#5B9BD5', badgeBg: '#5B9BD515', badgeColor: '#5B9BD5', change: '+8%' },
  { key: 'friends', label: 'home.stats.friends', icon: FavoriteIcon, iconColor: '#D4845E', badgeBg: '#D4845E15', badgeColor: '#D4845E', change: '+3 this month' },
  { key: 'level', label: 'home.stats.level', icon: MilitaryTechIcon, iconColor: '#9B8AA8', badgeBg: '#9B8AA815', badgeColor: '#9B8AA8' },
]

// Discord public_flags bitfield → badge definitions
// https://discord.com/developers/docs/resources/user#user-object-user-flags
const DISCORD_BADGES = [
  { bit: 0, name: 'Discord Staff', icon: ShieldIcon, bg: '#5865F215', color: '#5865F2' },
  { bit: 1, name: 'Partnered Server Owner', icon: VerifiedIcon, bg: '#5865F215', color: '#5865F2' },
  { bit: 2, name: 'HypeSquad Events', icon: EmojiEventsIcon, bg: '#F4720015', color: '#F47200' },
  { bit: 3, name: 'Bug Hunter Level 1', icon: BugReportIcon, bg: '#3BA55D15', color: '#3BA55D' },
  { bit: 6, name: 'HypeSquad Bravery', icon: LocalFireDepartmentIcon, bg: '#9B59B615', color: '#9B59B6' },
  { bit: 7, name: 'HypeSquad Brilliance', icon: AutoAwesomeIcon, bg: '#F4720015', color: '#F47200' },
  { bit: 8, name: 'HypeSquad Balance', icon: VolunteerActivismIcon, bg: '#2ECC7115', color: '#2ECC71' },
  { bit: 9, name: 'Early Nitro Supporter', icon: DiamondIcon, bg: '#F47FFF15', color: '#F47FFF' },
  { bit: 10, name: 'Team User', icon: GroupsIcon, bg: '#5865F215', color: '#5865F2' },
  { bit: 14, name: 'Bug Hunter Level 2', icon: BugReportIcon, bg: '#FFD70015', color: '#FFD700' },
  { bit: 17, name: 'Early Verified Bot Developer', icon: CodeIcon, bg: '#5865F215', color: '#5865F2' },
  { bit: 18, name: 'Discord Certified Moderator', icon: ShieldIcon, bg: '#5865F215', color: '#5865F2' },
  { bit: 22, name: 'Active Developer', icon: RocketLaunchIcon, bg: '#3BA55D15', color: '#3BA55D' },
]

// Nitro badge is not in public_flags — detect via premium_type or avatar animation
const NITRO_BADGE = { name: 'Nitro', icon: WorkspacePremiumIcon, bg: '#F47FFF15', color: '#F47FFF' }

function getDiscordBadges(discordFlags) {
  const flags = discordFlags ?? 0
  return DISCORD_BADGES.filter(({ bit }) => (flags & (1 << bit)) !== 0)
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [level, setLevel] = useState(null)
  const [profile, setProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAnn, setLoadingAnn] = useState(true)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || meta.name || 'User'

  const discordBadges = useMemo(() => getDiscordBadges(profile?.discord_flags), [profile])

  useEffect(() => {
    edgeFunctions.getStats()
      .then(setStats)
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoadingStats(false))

    edgeFunctions.listAnnouncements({ page: 1, pageSize: 3 })
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch((err) => console.error('Failed to load announcements:', err))
      .finally(() => setLoadingAnn(false))

    edgeFunctions.getMyLevel()
      .then(setLevel)
      .catch((err) => console.error('Failed to load level:', err))

    edgeFunctions.getOwnProfile()
      .then(setProfile)
      .catch((err) => console.error('Failed to load profile:', err))
  }, [])

  const xp = level?.xp ?? 0
  const lvl = level?.level ?? 1
  const xpNext = lvl * lvl * 10
  const xpProgress = xpNext > 0 ? Math.min((xp / xpNext) * 100, 100) : 0

  // Merge Discord badges + in-app badges
  const appBadges = (level?.badges ?? []).map((b) => ({
    name: b, icon: MilitaryTechIcon, bg: '#9B8AA815', color: '#9B8AA8',
  }))
  const allBadges = [...discordBadges, ...appBadges]

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.secondary' }}>
          {t('home.welcomeBack')}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 500, color: 'text.primary', fontFamily: 'serif', letterSpacing: -1 }}>
          {displayName}
        </Typography>
      </Box>

      {/* Stats Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {STAT_CARDS.map((card) => (
          <Card key={card.key} sx={{ p: 2.5, borderRadius: 4, boxShadow: '0 4px 30px #00000006' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                {t(card.label)}
              </Typography>
              <card.icon sx={{ fontSize: 18, color: card.iconColor }} />
            </Box>
            {loadingStats && card.key !== 'level' ? (
              <Skeleton variant="text" width={80} sx={{ fontSize: '2rem' }} />
            ) : card.key === 'level' ? (
              <>
                <Typography sx={{ fontSize: 32, fontWeight: 500, color: 'text.primary', fontFamily: 'serif', letterSpacing: -1 }}>
                  {t('levels.level', { level: lvl })}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={xpProgress}
                    sx={{
                      height: 6, borderRadius: 3, bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: '#9B8AA8', borderRadius: 3 },
                    }}
                  />
                  <Typography sx={{ fontSize: 10, fontWeight: 500, color: 'text.secondary', mt: 0.5 }}>
                    {t('levels.xp', { current: xp, next: xpNext })}
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 32, fontWeight: 500, color: 'text.primary', fontFamily: 'serif', letterSpacing: -1 }}>
                  {card.key === 'messages' ? (stats?.memberCount ?? 0) : card.key === 'vcHours' ? '—' : (stats?.eventCount ?? 0)}
                </Typography>
                {card.change && (
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1.2, py: 0.4, borderRadius: 1.5, bgcolor: card.badgeBg, mt: 0.5,
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 12, color: card.badgeColor }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 500, color: card.badgeColor, fontFamily: 'monospace' }}>
                      {card.change}
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
            <Typography sx={{ fontSize: 16, fontWeight: 500, color: 'text.primary', fontFamily: 'serif' }}>
              {t('home.badges')}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
              {allBadges.length} {t('home.earned')}
            </Typography>
          </Box>
          {allBadges.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>
              {t('home.noBadges')}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {allBadges.map((badge, i) => (
                <Tooltip key={i} title={badge.name} arrow>
                  <Box sx={{
                    width: 48, height: 48, minWidth: 48, borderRadius: 3, bgcolor: badge.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'default', transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.1)' },
                  }}>
                    <badge.icon sx={{ fontSize: 24, color: badge.color }} />
                  </Box>
                </Tooltip>
              ))}
            </Box>
          )}
        </Card>

        {/* Latest Announcements */}
        <Card sx={{ p: 2.5, borderRadius: 4, boxShadow: '0 4px 30px #00000006' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 500, color: 'text.primary', fontFamily: 'serif' }}>
              {t('home.latestAnnouncements')}
            </Typography>
            <Button size="small" onClick={() => navigate('/announcements')} sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t('home.viewAll')}
            </Button>
          </Box>
          {loadingAnn ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="text" height={36} />)}
            </Box>
          ) : announcements.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>
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
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}
                      secondaryTypographyProps={{ fontSize: 11, color: 'text.secondary' }}
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
