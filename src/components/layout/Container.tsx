/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { css } from '@emotion/react'

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: string | number
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(({
  maxWidth = 1156, style, ...rest
}, ref) => {
  const styles = css({
    width: '100%',
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    marginInline: 'auto',
    paddingInline: 'var(--spacing-5)',
  })
  return <div ref={ref} css={styles} style={style} {...rest} />
})

Container.displayName = 'Container'
export default Container
