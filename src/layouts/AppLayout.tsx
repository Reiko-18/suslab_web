import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import { useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import PeopleIcon from '@mui/icons-material/People'
import EventIcon from '@mui/icons-material/Event'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import PersonIcon from '@mui/icons-material/Person'
import NavRail from '../components/NavRail'
import NavDrawer from '../components/NavDrawer'
import TopAppBar from '../components/TopAppBar'
import type { SvgIconComponent } from '@mui/icons-material'

const TITLE_MAP: Record<string, string> = {
  '/home': 'nav.home',
  '/members': 'nav.members',
  '/profile': 'nav.profile',
  '/events': 'nav.events',
  '/todos': 'nav.todos',
  '/announcements': 'nav.announcements',
  '/games': 'nav.games',
  '/feedback': 'nav.feedback',
  '/admin/roles': 'nav.admin.roles',
  '/admin/users': 'nav.admin.users',
  '/admin/tickets': 'nav.admin.tickets',
  '/admin/feedback': 'nav.admin.feedbackReview',
  '/admin/settings': 'nav.admin.settings',
}

interface BottomNavItem {
  path: string
  icon: SvgIconComponent
  key: string
}

const BOTTOM_NAV: BottomNavItem[] = [
  { path: '/home', icon: HomeIcon, key: 'nav.home' },
  { path: '/members', icon: PeopleIcon, key: 'nav.members' },
  { path: '/events', icon: EventIcon, key: 'nav.events' },
  { path: '/games', icon: SportsEsportsIcon, key: 'nav.games' },
  { path: '/profile', icon: PersonIcon, key: 'nav.profile' },
]

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const titleKey = TITLE_MAP[location.pathname] || 'nav.home'
  const bottomIdx = BOTTOM_NAV.findIndex((n) => n.path === location.pathname)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <NavRail onExpand={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <TopAppBar title={t(titleKey)} onMenuClick={() => setDrawerOpen(!drawerOpen)} />

      <Box component="main" sx={{
        flexGrow: 1, ml: { xs: 0, md: '72px' },
        mt: '64px', mb: { xs: '56px', md: 0 },
        minHeight: 'calc(100vh - 64px)',
      }}>
        <Outlet />
      </Box>

      {/* Mobile bottom navigation */}
      <BottomNavigation value={bottomIdx === -1 ? false : bottomIdx} showLabels
        sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, borderTop: 1, borderColor: 'divider' }}
      >
        {BOTTOM_NAV.map((item) => (
          <BottomNavigationAction key={item.path} label={t(item.key)} icon={<item.icon />} onClick={() => navigate(item.path)} />
        ))}
      </BottomNavigation>
    </Box>
  )
}
