/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'rectangular' | 'circular' | 'text'
  borderRadius?: string
}

const pulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 0.3; }
`

export default function Skeleton({ width, height, variant = 'text', borderRadius }: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width
  const h = typeof height === 'number' ? `${height}px` : height

  return (
    <span
      css={css`
        display: block;
        background: var(--color-surface-container);
        animation: ${pulse} 1.5s ease-in-out infinite;
        flex-shrink: 0;

        ${variant === 'circular'
          ? `
            width: ${w ?? '40px'};
            height: ${h ?? w ?? '40px'};
            border-radius: 50%;
          `
          : variant === 'text'
            ? `
            width: ${w ?? '100%'};
            height: ${h ?? '1em'};
            border-radius: ${borderRadius ?? 'var(--radius-xs)'};
          `
            : `
            width: ${w ?? '100%'};
            height: ${h ?? '100px'};
            border-radius: ${borderRadius ?? 'var(--radius-sm)'};
          `}
      `}
    />
  )
}
