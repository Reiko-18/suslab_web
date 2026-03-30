/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Icon from './ui/Icon'

interface BottomNavItem {
  path: string
  icon: string
  key: string
}

const BOTTOM_NAV: BottomNavItem[] = [
  { path: '/home', icon: 'home', key: 'nav.home' },
  { path: '/members', icon: 'group', key: 'nav.members' },
  { path: '/events', icon: 'event', key: 'nav.events' },
  { path: '/games', icon: 'sports_esports', key: 'nav.games' },
  { path: '/profile', icon: 'person', key: 'nav.profile' },
]

const barStyle = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 56px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-divider);

  @media (min-width: 900px) {
    display: none;
  }
`

const itemStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-on-surface-dim);
  transition: color 0.15s;

  &:hover {
    color: var(--color-on-surface);
  }
`

const itemActiveStyle = css`
  color: var(--color-primary);
  font-weight: 600;
`

export default function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav css={barStyle}>
      {BOTTOM_NAV.map((item) => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            css={[itemStyle, active && itemActiveStyle]}
          >
            <Icon name={item.icon} size={24} />
            <span>{t(item.key)}</span>
          </button>
        )
      })}
    </nav>
  )
}
