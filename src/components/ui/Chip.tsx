/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Icon from './Icon'

interface ChipProps {
  label: string
  color?: string
  bg?: string
  icon?: string
  onDelete?: () => void
  onClick?: () => void
  size?: 'small' | 'medium'
  variant?: 'filled' | 'outlined'
}

export default function Chip({
  label,
  color,
  bg,
  icon,
  onDelete,
  onClick,
  size = 'medium',
  variant = 'filled',
}: ChipProps) {
  const isSmall = size === 'small'
  const iconSize = isSmall ? 14 : 18

  return (
    <span
      css={[
        css`
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: ${isSmall ? '12px' : '14px'};
          padding: ${isSmall ? '2px 8px' : '4px 12px'};
          border-radius: var(--radius-full);
          line-height: 1.4;
          white-space: nowrap;
          transition: opacity 0.15s;
        `,
        variant === 'filled'
          ? css`
              background: ${bg ?? 'var(--color-surface-container)'};
              color: ${color ?? 'var(--color-on-surface)'};
            `
          : css`
              background: transparent;
              border: 1px solid ${bg ?? 'var(--color-divider)'};
              color: ${color ?? 'var(--color-on-surface)'};
            `,
        onClick &&
          css`
            cursor: pointer;
            &:hover { opacity: 0.8; }
          `,
      ]}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {label}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          css={css`
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            margin-left: 2px;
            background: none;
            border: none;
            cursor: pointer;
            opacity: 0.7;
            border-radius: 50%;
            &:hover { opacity: 1; }
          `}
        >
          <Icon name="close" size={iconSize} />
        </button>
      )}
    </span>
  )
}
