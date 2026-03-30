/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

interface LinearProgressProps {
  value?: number
  color?: string
}

const indeterminate = keyframes`
  0%   { left: -30%; width: 30%; }
  50%  { left: 50%;  width: 40%; }
  100% { left: 100%; width: 30%; }
`

export default function LinearProgress({ value, color }: LinearProgressProps) {
  const barColor = color ?? 'var(--color-primary)'
  const isDeterminate = value !== undefined

  return (
    <div
      role="progressbar"
      aria-valuenow={isDeterminate ? value : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      css={css`
        position: relative;
        width: 100%;
        height: 4px;
        background: var(--color-surface-container);
        border-radius: 2px;
        overflow: hidden;
      `}
    >
      <div
        css={
          isDeterminate
            ? css`
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: ${Math.min(100, Math.max(0, value))}%;
                background: ${barColor};
                border-radius: 2px;
                transition: width 0.3s ease;
              `
            : css`
                position: absolute;
                top: 0;
                height: 100%;
                background: ${barColor};
                border-radius: 2px;
                animation: ${indeterminate} 1.5s ease-in-out infinite;
              `
        }
      />
    </div>
  )
}
