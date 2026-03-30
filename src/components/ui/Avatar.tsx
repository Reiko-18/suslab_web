/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface AvatarProps {
  src?: string
  alt?: string
  size?: number
  fallback?: string
  status?: 'online' | 'idle' | 'dnd' | 'offline'
  bg?: string
  onClick?: () => void
}

const statusColors: Record<string, string> = {
  online: 'var(--color-success)',
  idle: 'var(--color-warning)',
  dnd: 'var(--color-error)',
  offline: 'var(--color-on-surface-dim)',
}

export default function Avatar({ src, alt, size = 40, fallback, status, bg, onClick }: AvatarProps) {
  const fontSize = Math.round(size * 0.4)
  const dotSize = Math.max(8, Math.round(size * 0.25))

  return (
    <div
      css={css`
        position: relative;
        width: ${size}px;
        height: ${size}px;
        flex-shrink: 0;
        display: inline-flex;
        ${onClick ? 'cursor: pointer;' : ''}
      `}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          css={css`
            width: 100%;
            height: 100%;
            border-radius: var(--radius-full);
            object-fit: cover;
          `}
        />
      ) : (
        <div
          css={css`
            width: 100%;
            height: 100%;
            border-radius: var(--radius-full);
            background: ${bg ?? 'var(--color-primary-container)'};
            color: ${bg ? '#fff' : 'var(--color-on-primary-container)'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${fontSize}px;
            font-weight: 600;
            user-select: none;
          `}
        >
          {fallback ?? '?'}
        </div>
      )}
      {status && (
        <span
          css={css`
            position: absolute;
            bottom: 0;
            right: 0;
            width: ${dotSize}px;
            height: ${dotSize}px;
            border-radius: 50%;
            background: ${statusColors[status]};
            border: 2px solid var(--color-surface);
          `}
        />
      )}
    </div>
  )
}
