/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column'
  gap?: string | number
  align?: string
  justify?: string
  wrap?: boolean
  flex?: string | number
}

const Stack = forwardRef<HTMLDivElement, StackProps>(({
  direction = 'column', gap = 0, align, justify, wrap, flex, style, ...rest
}, ref) => {
  const styles = css({
    display: 'flex',
    flexDirection: direction,
    gap,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : undefined,
    flex,
  })
  return <div ref={ref} css={styles} style={style} {...rest} />
})

Stack.displayName = 'Stack'
export default Stack
