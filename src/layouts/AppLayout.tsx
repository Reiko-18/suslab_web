/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBreakpoint } from '../hooks/useBreakpoint'
import NavRail from '../components/NavRail'
import NavDrawer from '../components/NavDrawer'
import TopAppBar from '../components/TopAppBar'
import BottomNav from '../components/BottomNav'

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

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation()
  const bp = useBreakpoint()
  const isDesktop = bp === 'desktop'

  const titleKey = TITLE_MAP[location.pathname] || 'nav.home'

  return (
    <div
      css={css`
        display: flex;
        min-height: 100vh;
      `}
    >
      <NavRail onExpand={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <TopAppBar title={t(titleKey)} onMenuClick={() => setDrawerOpen(!drawerOpen)} />

      <main
        css={css`
          flex: 1;
          margin-left: ${isDesktop ? '72px' : '0'};
          margin-top: 64px;
          margin-bottom: ${isDesktop ? '0' : '56px'};
          min-height: calc(100vh - 64px);
          background: #202225;
          padding: ${isDesktop ? '10px' : '0'};
        `}
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
