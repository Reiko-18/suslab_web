/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import Icon from './Icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'fab'
type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  startIcon?: string
  endIcon?: string
  fullWidth?: boolean
  children?: ReactNode
}

const sizeStyles: Record<ButtonSize, ReturnType<typeof css>> = {
  small: css`
    font-size: 12px;
    padding: 4px 12px;
    gap: 4px;
  `,
  medium: css`
    font-size: 14px;
    padding: 8px 16px;
    gap: 6px;
  `,
  large: css`
    font-size: 16px;
    padding: 12px 24px;
    gap: 8px;
  `,
}

const baseStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s, opacity 0.15s, box-shadow 0.15s;
  white-space: nowrap;
  line-height: 1.4;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
`

const variantStyles: Record<ButtonVariant, ReturnType<typeof css>> = {
  primary: css`
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-radius: var(--radius-xs);

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  `,
  secondary: css`
    background: var(--color-surface-bright);
    color: var(--color-on-surface);
    border-radius: var(--radius-xs);

    &:hover:not(:disabled) {
      opacity: 0.85;
    }
  `,
  ghost: css`
    background: transparent;
    color: var(--color-on-surface);
    border-radius: var(--radius-xs);

    &:hover:not(:disabled) {
      background: var(--color-surface-container);
    }
  `,
  icon: css`
    background: transparent;
    color: var(--color-on-surface);
    border-radius: var(--radius-full);
    padding: 8px;

    &:hover:not(:disabled) {
      background: var(--color-surface-container);
    }
  `,
  fab: css`
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-radius: var(--radius-full);
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: var(--z-sticky);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 16px;

    &:hover:not(:disabled) {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    @media (max-width: 599px) {
      bottom: calc(56px + 16px);
    }
  `,
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      startIcon,
      endIcon,
      fullWidth,
      children,
      ...rest
    },
    ref,
  ) => {
    const iconSize = size === 'small' ? 16 : size === 'large' ? 22 : 18

    return (
      <button
        ref={ref}
        css={[
          baseStyle,
          variant !== 'icon' && variant !== 'fab' && sizeStyles[size],
          variantStyles[variant],
          fullWidth && css`width: 100%;`,
        ]}
        {...rest}
      >
        {startIcon && <Icon name={startIcon} size={iconSize} />}
        {children}
        {endIcon && <Icon name={endIcon} size={iconSize} />}
      </button>
    )
  },
)

Button.displayName = 'Button'
export default Button
