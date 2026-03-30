/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: { xs?: number; sm?: number; md?: number; lg?: number }
  gap?: string | number
  minChildWidth?: string
}

const Grid = forwardRef<HTMLDivElement, GridProps>(({
  columns, gap = 'var(--spacing-4)', minChildWidth, style, ...rest
}, ref) => {
  const styles = minChildWidth
    ? css({
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minChildWidth}, 1fr))`,
        gap,
      })
    : css({
        display: 'grid',
        gridTemplateColumns: `repeat(${columns?.xs ?? 1}, 1fr)`,
        gap,
        '@media (min-width: 600px)': columns?.sm
          ? { gridTemplateColumns: `repeat(${columns.sm}, 1fr)` }
          : undefined,
        '@media (min-width: 769px)': columns?.md
          ? { gridTemplateColumns: `repeat(${columns.md}, 1fr)` }
          : undefined,
        '@media (min-width: 1025px)': columns?.lg
          ? { gridTemplateColumns: `repeat(${columns.lg}, 1fr)` }
          : undefined,
      })

  return <div ref={ref} css={styles} style={style} {...rest} />
})

Grid.displayName = 'Grid'
export default Grid
