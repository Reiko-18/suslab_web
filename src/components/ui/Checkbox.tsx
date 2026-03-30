/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Icon from './Icon'

interface CheckboxProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export default function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: var(--radius-xs);
          border: 2px solid ${checked ? 'var(--color-primary)' : 'var(--color-divider)'};
          background: ${checked ? 'var(--color-primary)' : 'transparent'};
          color: var(--color-on-primary);
          transition: background 0.15s, border-color 0.15s;
          flex-shrink: 0;
        `}
      >
        {checked && <Icon name="check" size={16} />}
      </span>
      {label && (
        <span css={css`font-size: 14px; color: var(--color-on-surface);`}>{label}</span>
      )}
    </label>
  )
}
