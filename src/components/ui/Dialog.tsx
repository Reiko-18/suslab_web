/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  actions?: ReactNode
  maxWidth?: number
}

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`
const slideUp = keyframes`from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); }`

export default function Dialog({ open, onClose, title, children, actions, maxWidth = 480 }: DialogProps) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      css={css`
        position: fixed;
        inset: 0;
        z-index: var(--z-dialog);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-4);
      `}
    >
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        css={css`
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          animation: ${fadeIn} 0.2s ease-out;
        `}
      />
      {/* 內容區 */}
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        css={css`
          position: relative;
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding: var(--spacing-6);
          width: 100%;
          max-width: ${maxWidth}px;
          max-height: calc(100vh - 64px);
          overflow-y: auto;
          animation: ${slideUp} 0.25s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `}
      >
        {title && (
          <h2
            css={css`
              font-size: 18px;
              font-weight: 600;
              color: var(--color-on-surface);
              margin-bottom: var(--spacing-4);
            `}
          >
            {title}
          </h2>
        )}
        <div css={css`color: var(--color-on-surface-muted); font-size: 14px;`}>{children}</div>
        {actions && (
          <div
            css={css`
              display: flex;
              justify-content: flex-end;
              gap: var(--spacing-2);
              margin-top: var(--spacing-5);
            `}
          >
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
