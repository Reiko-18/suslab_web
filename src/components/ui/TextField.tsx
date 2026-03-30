/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  multiline?: boolean
  rows?: number
  startAdornment?: ReactNode
  endAdornment?: ReactNode
}

const wrapperStyle = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  background: var(--color-surface);
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
  }
`

const errorWrapperStyle = css`
  border-color: var(--color-error);
  &:focus-within {
    border-color: var(--color-error);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-error) 25%, transparent);
  }
`

const inputStyle = css`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-on-surface);
  font-size: 14px;
  line-height: 1.5;
  min-width: 0;

  &::placeholder {
    color: var(--color-on-surface-dim);
  }
`

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth,
      multiline,
      rows = 3,
      startAdornment,
      endAdornment,
      id,
      ...rest
    },
    ref,
  ) => {
    const fieldId = id ?? (label ? `field-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)

    return (
      <div css={css`display: flex; flex-direction: column; gap: 4px; ${fullWidth ? 'width: 100%;' : ''}`}>
        {label && (
          <label
            htmlFor={fieldId}
            css={css`
              font-size: 13px;
              font-weight: 500;
              color: ${error ? 'var(--color-error)' : 'var(--color-on-surface-muted)'};
            `}
          >
            {label}
          </label>
        )}
        <div css={[wrapperStyle, error && errorWrapperStyle]}>
          {startAdornment}
          {multiline ? (
            <textarea
              id={fieldId}
              rows={rows}
              css={[inputStyle, css`resize: vertical;`]}
              {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref}
              id={fieldId}
              css={inputStyle}
              {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
          {endAdornment}
        </div>
        {(error || helperText) && (
          <span
            css={css`
              font-size: 12px;
              color: ${error ? 'var(--color-error)' : 'var(--color-on-surface-dim)'};
            `}
          >
            {error || helperText}
          </span>
        )}
      </div>
    )
  },
)

TextField.displayName = 'TextField'
export default TextField
