/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export default function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label
      css={css`
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        cursor: ${disabled ? 'not-allowed' : 'pointer'};
        opacity: ${disabled ? 0.5 : 1};
        user-select: none;
      `}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        css={css`
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: none;
        `}
      />
      <span
        css={css`
          position: relative;
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: ${checked ? 'var(--color-primary)' : 'var(--color-surface-container)'};
          border: 2px solid ${checked ? 'var(--color-primary)' : 'var(--color-divider)'};
          transition: background 0.2s, border-color 0.2s;
          flex-shrink: 0;

          &::after {
            content: '';
            position: absolute;
            top: 2px;
            left: ${checked ? '22px' : '2px'};
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${checked ? 'var(--color-on-primary)' : 'var(--color-on-surface-dim)'};
            transition: left 0.2s;
          }
        `}
      />
      {label && (
        <span css={css`font-size: 14px; color: var(--color-on-surface);`}>{label}</span>
      )}
    </label>
  )
}
