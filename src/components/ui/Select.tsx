/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  fullWidth?: boolean
  error?: string
}

export default function Select({ label, value, onChange, options, fullWidth, error }: SelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  const toggle = () => {
    if (!open) updatePos()
    setOpen((prev) => !prev)
  }

  const select = (v: string) => {
    onChange?.(v)
    setOpen(false)
    triggerRef.current?.focus()
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
    <div css={css`display: flex; flex-direction: column; gap: 4px; ${fullWidth ? 'width: 100%;' : ''}`}>
      {label && (
        <span
          css={css`
            font-size: 13px;
            font-weight: 500;
            color: ${error ? 'var(--color-error)' : 'var(--color-on-surface-muted)'};
          `}
        >
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-2);
          padding: 8px 12px;
          border: 1px solid ${error ? 'var(--color-error)' : 'var(--color-divider)'};
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 14px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color 0.15s;

          &:focus-visible {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
          }
        `}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span css={css`flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>
          {selectedLabel || '\u00A0'}
        </span>
        <Icon
          name="expand_more"
          size={20}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>
      {error && (
        <span css={css`font-size: 12px; color: var(--color-error);`}>{error}</span>
      )}

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            css={css`
              position: fixed;
              top: ${pos.top}px;
              left: ${pos.left}px;
              width: ${pos.width}px;
              max-height: 240px;
              overflow-y: auto;
              background: var(--color-surface);
              border: 1px solid var(--color-divider);
              border-radius: var(--radius-sm);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
              z-index: var(--z-dropdown);
              padding: 4px 0;
            `}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => select(opt.value)}
                css={css`
                  padding: 8px 12px;
                  font-size: 14px;
                  cursor: pointer;
                  color: var(--color-on-surface);
                  background: ${opt.value === value ? 'var(--color-surface-container)' : 'transparent'};
                  &:hover {
                    background: var(--color-surface-container);
                  }
                `}
              >
                {opt.label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
