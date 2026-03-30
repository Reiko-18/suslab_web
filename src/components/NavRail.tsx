/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Icon from './ui/Icon'
import Tooltip from './ui/Tooltip'
import Divider from './ui/Divider'
import Avatar from './ui/Avatar'

export interface NavItem {
  key: string
  path: string
  icon: string
}

interface NavRailProps {
  onExpand: () => void
}

export const USER_NAV: NavItem[] = [
  { key: 'nav.home', path: '/home', icon: 'home' },
  { key: 'nav.members', path: '/members', icon: 'group' },
  { key: 'nav.events', path: '/events', icon: 'event' },
  { key: 'nav.todos', path: '/todos', icon: 'checklist' },
  { key: 'nav.announcements', path: '/announcements', icon: 'campaign' },
  { key: 'nav.games', path: '/games', icon: 'sports_esports' },
  { key: 'nav.feedback', path: '/feedback', icon: 'feedback' },
]

export const ADMIN_NAV: NavItem[] = [
  { key: 'nav.admin.overview', path: '/admin', icon: 'dashboard' },
  { key: 'nav.admin.roles', path: '/admin/roles', icon: 'shield' },
  { key: 'nav.admin.users', path: '/admin/users', icon: 'manage_accounts' },
  { key: 'nav.admin.tickets', path: '/admin/tickets', icon: 'confirmation_number' },
  { key: 'nav.admin.feedbackReview', path: '/admin/feedback', icon: 'rate_review' },
  { key: 'nav.admin.settings', path: '/admin/settings', icon: 'settings' },
]

const railStyle = css`
  width: 72px;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-sticky);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: #2f3136;
  border-right: 1px solid #202225;

  @media (max-width: 899px) {
    display: none;
  }
`

const navBtnBase = css`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
`

export default function NavRail({ onExpand }: NavRailProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const renderItem = ({ key, path, icon }: NavItem) => {
    const active = location.pathname === path
    return (
      <Tooltip key={path} title={t(key)} placement="right">
        <button
          type="button"
          onClick={() => navigate(path)}
          css={[
            navBtnBase,
            css`
              color: ${active ? '#ffffff' : '#b9bbbe'};
              background: ${active ? '#5865f2' : 'transparent'};

              &:hover {
                background: ${active ? '#5865f2' : '#36393f'};
              }
            `,
          ]}
        >
          <Icon name={icon} size={24} />
        </button>
      </Tooltip>
    )
  }

  return (
    <nav css={railStyle}>
      <Tooltip title="SusLab" placement="right">
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open navigation menu"
          css={css`
            width: 48px;
            height: 48px;
            margin-bottom: 8px;
            border: none;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          `}
        >
          <Avatar size={36} fallback="S" bg="var(--color-primary)" />
        </button>
      </Tooltip>

      {USER_NAV.map(renderItem)}

      {hasRole('moderator') && (
        <>
          <Divider width="40px" spacing="4px" />
          {ADMIN_NAV.map(renderItem)}
        </>
      )}
    </nav>
  )
}
