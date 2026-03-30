/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { type ReactNode } from 'react'
import Icon from './Icon'

type Severity = 'success' | 'error' | 'warning' | 'info'

interface AlertProps {
  severity?: Severity
  children?: ReactNode
  onClose?: () => void
}

const config: Record<Severity, { icon: string; color: string }> = {
  success: { icon: 'check_circle', color: 'var(--color-success)' },
  error: { icon: 'error', color: 'var(--color-error)' },
  warning: { icon: 'warning', color: 'var(--color-warning)' },
  info: { icon: 'info', color: 'var(--color-primary)' },
}

export default function Alert({ severity = 'info', children, onClose }: AlertProps) {
  const { icon, color } = config[severity]

  return (
    <div
      role="alert"
      css={css`
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-sm);
        border-left: 4px solid ${color};
        background: var(--color-surface-container);
        color: var(--color-on-surface);
        font-size: 14px;
      `}
    >
      <Icon name={icon} size={20} style={{ color, flexShrink: 0, marginTop: 1 }} />
      <div css={css`flex: 1; line-height: 1.5;`}>{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          css={css`
            display: flex;
            padding: 2px;
            border: none;
            background: none;
            cursor: pointer;
            color: var(--color-on-surface-muted);
            border-radius: var(--radius-full);
            &:hover { background: var(--color-surface-bright); }
          `}
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
