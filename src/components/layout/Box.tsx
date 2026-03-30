/** @jsxImportSource @emotion/react */
import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes, ElementType } from 'react'
import { css } from '@emotion/react'

interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  display?: CSSProperties['display']
  flex?: CSSProperties['flex']
  flexDirection?: CSSProperties['flexDirection']
  alignItems?: CSSProperties['alignItems']
  justifyContent?: CSSProperties['justifyContent']
  gap?: string | number
  p?: string | number
  px?: string | number
  py?: string | number
  m?: string | number
  mx?: string | number
  my?: string | number
  mt?: string | number
  mb?: string | number
  ml?: string | number
  mr?: string | number
  width?: string | number
  height?: string | number
  minHeight?: string | number
  maxWidth?: string | number
  position?: CSSProperties['position']
  overflow?: CSSProperties['overflow']
  cursor?: CSSProperties['cursor']
  bg?: string
  color?: string
  borderRadius?: string | number
}

const Box = forwardRef<HTMLElement, BoxProps>(({
  as: Component = 'div', display, flex, flexDirection, alignItems, justifyContent,
  gap, p, px, py, m, mx, my, mt, mb, ml, mr,
  width, height, minHeight, maxWidth, position, overflow, cursor,
  bg, color, borderRadius, style, ...rest
}, ref) => {
  const styles = css({
    display, flex, flexDirection, alignItems, justifyContent,
    gap, padding: p, paddingInline: px, paddingBlock: py,
    margin: m, marginInline: mx, marginBlock: my,
    marginTop: mt, marginBottom: mb, marginLeft: ml, marginRight: mr,
    width, height, minHeight, maxWidth, position, overflow, cursor,
    background: bg, color, borderRadius,
  })

  return <Component ref={ref} css={styles} style={style} {...rest} />
})

Box.displayName = 'Box'
export default Box
