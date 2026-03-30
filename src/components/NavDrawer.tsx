/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { USER_NAV, ADMIN_NAV } from './NavRail'
import type { NavItem } from './NavRail'
import Icon from './ui/Icon'
import Avatar from './ui/Avatar'
import Divider from './ui/Divider'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
  variant?: 'temporary' | 'persistent' | 'permanent'
}

const slideIn = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`

const overlayStyle = css`
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 0.2s ease-out;
`

const panelStyle = css`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 240px;
  z-index: var(--z-overlay);
  background: var(--color-surface);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  animation: ${slideIn} 0.2s ease-out;
  overflow-y: auto;
`

const listItemStyle = css`
  display: flex;
  align-items: center;
  gap: 12px;
  width: calc(100% - 16px);
  margin: 0 8px 2px;
  padding: 10px 12px;
  border: none;
  border-radius: 24px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-on-surface);
  transition: background 0.15s;

  &:hover {
    background: var(--color-surface-container);
  }
`

const listItemActiveStyle = css`
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);

  &:hover {
    background: var(--color-primary-container);
  }
`

export default function NavDrawer({ open, onClose, variant = 'temporary' }: NavDrawerProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const meta = user?.user_metadata || {}
  const displayName: string = meta.full_name || meta.user_name || 'User'
  const avatar: string | undefined = meta.avatar_url

  const handleNav = (path: string) => {
    navigate(path)
    if (variant === 'temporary') onClose()
  }

  // 按下 Escape 關閉
  useEffect(() => {
    if (!open || variant !== 'temporary') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, variant])

  const renderItem = ({ key, path, icon }: NavItem) => {
    const active = location.pathname === path
    return (
      <button
        key={path}
        type="button"
        onClick={() => handleNav(path)}
        css={[listItemStyle, active && listItemActiveStyle]}
      >
        <Icon name={icon} size={24} />
        <span>{t(key)}</span>
      </button>
    )
  }

  if (!open) return null

  const content = (
    <>
      {variant === 'temporary' && (
        <div css={overlayStyle} onClick={onClose} aria-hidden="true" />
      )}
      <aside css={panelStyle}>
        {/* 頂部品牌區 */}
        <div
          css={css`
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          `}
        >
          <Avatar size={36} fallback="S" bg="var(--color-primary)" />
          <span
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: var(--color-on-surface);
            `}
          >
            SusLab
          </span>
        </div>

        {/* 導覽列表 */}
        <nav
          css={css`
            flex: 1;
            padding: 4px 0;
          `}
        >
          {USER_NAV.map(renderItem)}

          {hasRole('moderator') && (
            <>
              <Divider spacing="8px" />
              <span
                css={css`
                  display: block;
                  padding: 4px 24px;
                  font-size: 11px;
                  color: var(--color-on-surface-dim);
                  text-transform: uppercase;
                  letter-spacing: 1px;
                `}
              >
                {t('nav.admin.label')}
              </span>
              {ADMIN_NAV.map(renderItem)}
            </>
          )}
        </nav>

        {/* 底部使用者區 */}
        {user && (
          <div
            onClick={() => handleNav('/profile')}
            css={css`
              padding: 12px 16px;
              border-top: 1px solid var(--color-divider);
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;

              &:hover {
                background: var(--color-surface-container);
              }
            `}
          >
            <Avatar src={avatar} size={32} fallback={displayName[0]} />
            <span
              css={css`
                font-size: 14px;
                color: var(--color-on-surface);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              `}
            >
              {displayName}
            </span>
          </div>
        )}
      </aside>
    </>
  )

  if (variant === 'temporary') {
    return createPortal(content, document.body)
  }

  return content
}
