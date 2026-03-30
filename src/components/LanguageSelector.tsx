/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Icon, Button } from './ui'

interface Language {
  code: string
  label: string
}

const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
]

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.right })
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
        !menuRef.current?.contains(e.target as Node)
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
      <Button ref={triggerRef} variant="icon" onClick={toggle} aria-label="language">
        <Icon name="translate" size={22} />
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            css={css`
              position: fixed;
              top: ${pos.top}px;
              left: ${pos.left}px;
              transform: translateX(-100%);
              min-width: 160px;
              background: var(--color-surface);
              border: 1px solid var(--color-divider);
              border-radius: var(--radius-sm);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
              z-index: var(--z-dropdown);
              padding: 4px 0;
            `}
          >
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                role="menuitem"
                onClick={() => {
                  i18n.changeLanguage(code)
                  setOpen(false)
                }}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: var(--spacing-2);
                  width: 100%;
                  padding: 8px 12px;
                  font-size: 14px;
                  text-align: left;
                  border: none;
                  background: ${i18n.language === code ? 'var(--color-surface-container)' : 'none'};
                  cursor: pointer;
                  color: var(--color-on-surface);

                  &:hover {
                    background: var(--color-surface-container);
                  }
                `}
              >
                <span
                  css={css`
                    width: 20px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                  `}
                >
                  {i18n.language === code && <Icon name="check" size={16} />}
                </span>
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
