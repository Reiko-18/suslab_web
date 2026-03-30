/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

interface CircularProgressProps {
  size?: number
  color?: string
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`

export default function CircularProgress({ size = 40, color }: CircularProgressProps) {
  const strokeWidth = Math.max(2, size * 0.1)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      css={css`
        animation: ${spin} 1s linear infinite;
        flex-shrink: 0;
      `}
      role="progressbar"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color ?? 'var(--color-primary)'}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
        strokeLinecap="round"
      />
    </svg>
  )
}
