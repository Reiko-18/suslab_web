/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeControls } from '../theme/ThemeProvider'
import { createPortal } from 'react-dom'
import { Icon, Button } from './ui'

const PRESETS = [
  '#6750A4', '#0061A4', '#006E1C', '#984061',
  '#8B5000', '#006874', '#7D5260', '#1E6B52',
]

export default function ThemeColorPicker() {
  const { t } = useTranslation()
  const themeControls = useThemeControls()
  const seedColor = themeControls?.seedColor ?? '#7C9070'
  const setSeedColor = themeControls?.setSeedColor ?? (() => undefined)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left + r.width / 2 })
  }, [])

  const toggle = () => {
    if (!open) updatePos()
    setOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <Button ref={triggerRef} variant="icon" onClick={toggle} aria-label="theme color">
        <Icon name="palette" size={22} />
      </Button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            css={css`
              position: fixed;
              top: ${pos.top}px;
              left: ${pos.left}px;
              transform: translateX(-50%);
              width: 220px;
              background: var(--color-surface);
              border: 1px solid var(--color-divider);
              border-radius: var(--radius-sm);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
              z-index: var(--z-dropdown);
              padding: 16px;
            `}
          >
            <p
              css={css`
                font-size: 13px;
                font-weight: 600;
                color: var(--color-on-surface);
                margin: 0 0 8px 0;
              `}
            >
              {t('theme.color')}
            </p>
            <div
              css={css`
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
              `}
            >
              {PRESETS.map((color) => (
                <div
                  key={color}
                  onClick={() => {
                    setSeedColor(color)
                    setOpen(false)
                  }}
                  css={css`
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: ${color};
                    cursor: pointer;
                    border: ${seedColor === color ? '3px solid var(--color-on-surface)' : '2px solid transparent'};
                    transition: transform 0.2s;
                    &:hover {
                      transform: scale(1.15);
                    }
                  `}
                />
              ))}
            </div>
            <div
              css={css`
                margin-top: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
              `}
            >
              <input
                type="color"
                value={seedColor}
                onChange={(e) => setSeedColor(e.target.value)}
                css={css`
                  width: 36px;
                  height: 36px;
                  border: none;
                  cursor: pointer;
                  border-radius: 4px;
                  padding: 0;
                `}
              />
              <span
                css={css`
                  font-size: 12px;
                  color: var(--color-on-surface-muted);
                `}
              >
                {t('theme.color')}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
