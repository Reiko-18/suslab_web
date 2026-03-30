/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

interface MenuItem {
  label: string
  icon?: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
}

interface MenuProps {
  trigger: ReactElement
  items: MenuItem[]
}

export default function Menu({ trigger, items }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
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

  if (!isValidElement(trigger)) return null

  const triggerEl = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    ref: triggerRef,
    onClick: toggle,
  })

  return (
    <>
      {triggerEl}
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
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.()
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
                  background: none;
                  cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                  color: ${item.danger ? 'var(--color-error)' : 'var(--color-on-surface)'};
                  opacity: ${item.disabled ? 0.5 : 1};

                  &:hover:not(:disabled) {
                    background: var(--color-surface-container);
                  }
                `}
              >
                {item.icon && <Icon name={item.icon} size={18} />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
