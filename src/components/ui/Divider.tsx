/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface DividerProps {
  vertical?: boolean
  spacing?: string
  width?: string
}

export default function Divider({ vertical, spacing, width }: DividerProps) {
  return (
    <hr
      css={css`
        border: none;
        flex-shrink: 0;
        ${vertical
          ? `
            width: ${width ?? '1px'};
            align-self: stretch;
            margin: 0 ${spacing ?? 'var(--spacing-2)'};
            background: var(--color-divider);
          `
          : `
            height: ${width ?? '1px'};
            width: 100%;
            margin: ${spacing ?? 'var(--spacing-2)'} 0;
            background: var(--color-divider);
          `}
      `}
    />
  )
}
