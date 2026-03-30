/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SnackbarProps {
  open: boolean
  onClose: () => void
  message: string
  autoHideDuration?: number
  action?: ReactNode
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

export default function Snackbar({ open, onClose, message, autoHideDuration = 4000, action }: SnackbarProps) {
  useEffect(() => {
    if (!open || autoHideDuration <= 0) return
    const timer = setTimeout(onClose, autoHideDuration)
    return () => clearTimeout(timer)
  }, [open, autoHideDuration, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      css={css`
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: var(--z-snackbar);
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
        background: var(--color-on-surface);
        color: var(--color-surface);
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        font-size: 14px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        animation: ${slideIn} 0.25s ease-out;
        max-width: calc(100vw - 32px);

        @media (max-width: 599px) {
          bottom: calc(56px + var(--spacing-4));
        }
      `}
    >
      <span css={css`flex: 1;`}>{message}</span>
      {action}
    </div>,
    document.body,
  )
}
