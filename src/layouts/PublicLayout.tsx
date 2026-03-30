/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useThemeControls } from '../theme/ThemeProvider'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import LanguageSelector from '../components/LanguageSelector'
import ThemeColorPicker from '../components/ThemeColorPicker'

const headerStyle = css`
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
  background: transparent;
  border-bottom: 1px solid var(--color-divider);
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

const loginBtnStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 6px 16px;
  border: none;
  border-radius: 24px;
  background: #4A7C59;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #3D6B4B;
  }
`

export default function PublicLayout() {
  const { t } = useTranslation()
  const { mode, toggleMode } = useThemeControls()
  const { signInWithDiscord } = useAuth()

  return (
    <div
      css={css`
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      `}
    >
      <header css={headerStyle}>
        <Avatar size={32} fallback="S" bg="var(--color-primary)" />
        <span
          css={css`
            font-size: 1.25rem;
            font-weight: 700;
            margin-left: 8px;
            flex: 1;
          `}
        >
          SusLab
        </span>

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
        <button type="button" onClick={signInWithDiscord} css={loginBtnStyle}>
          <Icon name="login" size={18} />
          Login
        </button>
      </header>

      <div css={css`flex: 1;`}>
        <Outlet />
      </div>
    </div>
  )
}
