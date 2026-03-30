import { ElementType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import { alpha } from '@mui/material/styles'
import HomeIcon from '@mui/icons-material/Home'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CampaignIcon from '@mui/icons-material/Campaign'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import FeedbackIcon from '@mui/icons-material/Feedback'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import RateReviewIcon from '@mui/icons-material/RateReview'
import SettingsIcon from '@mui/icons-material/Settings'
import ShieldIcon from '@mui/icons-material/Shield'
import DashboardIcon from '@mui/icons-material/Dashboard'

interface NavItem {
  key: string
  path: string
  icon: ElementType
}

interface NavRailProps {
  onExpand: () => void
}

export const USER_NAV: NavItem[] = [
  { key: 'nav.home', path: '/home', icon: HomeIcon },
  { key: 'nav.members', path: '/members', icon: PeopleIcon },
  { key: 'nav.events', path: '/events', icon: EventIcon },
  { key: 'nav.todos', path: '/todos', icon: ChecklistIcon },
  { key: 'nav.announcements', path: '/announcements', icon: CampaignIcon },
  { key: 'nav.games', path: '/games', icon: SportsEsportsIcon },
  { key: 'nav.feedback', path: '/feedback', icon: FeedbackIcon },
]

export const ADMIN_NAV: NavItem[] = [
  { key: 'nav.admin.overview', path: '/admin', icon: DashboardIcon },
  { key: 'nav.admin.roles', path: '/admin/roles', icon: ShieldIcon },
  { key: 'nav.admin.users', path: '/admin/users', icon: ManageAccountsIcon },
  { key: 'nav.admin.tickets', path: '/admin/tickets', icon: ConfirmationNumberIcon },
  { key: 'nav.admin.feedbackReview', path: '/admin/feedback', icon: RateReviewIcon },
  { key: 'nav.admin.settings', path: '/admin/settings', icon: SettingsIcon },
]

export default function NavRail({ onExpand }: NavRailProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  // eslint-disable-next-line no-unused-vars
  const renderItem = ({ key, path, icon: Icon }: NavItem) => {
    const active = location.pathname === path
    return (
      <Tooltip key={path} title={t(key)} placement="right">
        <IconButton
          onClick={() => navigate(path)}
          sx={{
            width: 48, height: 48, borderRadius: 3,
            color: active ? '#ffffff' : '#b9bbbe',
            bgcolor: active ? '#5865f2' : 'transparent',
            '&:hover': { bgcolor: active ? '#5865f2' : '#36393f' },
          }}
        >
          <Icon />
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <Box sx={{
      width: 72, height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1200,
      display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center',
      py: 1, gap: 0.5, bgcolor: '#2f3136', borderRight: 1, borderColor: '#202225',
    }}>
      <Tooltip title="SusLab" placement="right">
        <IconButton onClick={onExpand} aria-label="Open navigation menu" sx={{ width: 48, height: 48, mb: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>S</Avatar>
        </IconButton>
      </Tooltip>

      {USER_NAV.map(renderItem)}

      {hasRole('moderator') && (
        <>
          <Divider sx={{ width: 40, my: 0.5 }} />
          {ADMIN_NAV.map(renderItem)}
        </>
      )}
    </Box>
  )
}
