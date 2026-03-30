/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useThemeControls } from '../theme/ThemeProvider'
import Icon from './ui/Icon'
import Avatar from './ui/Avatar'
import Menu from './ui/Menu'
import ThemeColorPicker from './ThemeColorPicker'
import LanguageSelector from './LanguageSelector'

interface TopAppBarProps {
  title: string
  onMenuClick: () => void
}

const appBarStyle = css`
  position: fixed;
  top: 0;
  right: 0;
  left: 72px;
  height: 64px;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #2f3136;
  color: #dcddde;
  border-bottom: 1px solid #202225;

  @media (max-width: 899px) {
    left: 0;
  }
`

const iconBtnStyle = css`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`

export default function TopAppBar({ title, onMenuClick }: TopAppBarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const themeControls = useThemeControls()
  const mode = themeControls?.mode ?? 'light'
  const toggleMode = themeControls?.toggleMode ?? (() => undefined)

  const meta = user?.user_metadata || {}
  const displayName: string = meta.full_name || meta.user_name || 'User'
  const avatar: string | undefined = meta.avatar_url

  return (
    <header css={appBarStyle}>
      <button
        type="button"
        onClick={onMenuClick}
        css={[iconBtnStyle, css`margin-right: 8px;`]}
      >
        <Icon name="menu" size={24} />
      </button>

      <h1
        css={css`
          flex: 1;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `}
      >
        {title}
      </h1>

      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 4px;
        `}
      >
        <LanguageSelector />
        <button
          type="button"
          onClick={toggleMode}
          css={iconBtnStyle}
          aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')}
        >
          <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} size={24} />
        </button>
        <ThemeColorPicker />

        {user && (
          <Menu
            trigger={
              <button type="button" css={[iconBtnStyle, css`margin-left: 4px;`]}>
                <Avatar src={avatar} size={32} fallback={displayName[0]} />
              </button>
            }
            items={[
              {
                label: t('nav.profile'),
                icon: 'person',
                onClick: () => navigate('/profile'),
              },
              {
                label: t('profile.logout'),
                icon: 'logout',
                onClick: () => signOut(),
              },
            ]}
          />
        )}
      </div>
    </header>
  )
}
