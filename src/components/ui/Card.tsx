/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'container'
  radius?: 'sm' | 'md' | 'lg'
  padding?: string
  clickable?: boolean
}

const radiusMap = { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' }

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'surface', radius = 'md', padding, clickable, children, ...rest }, ref) => (
    <div
      ref={ref}
      css={[
        css`
          background: ${variant === 'container' ? 'var(--color-surface-container)' : 'var(--color-surface)'};
          border-radius: ${radiusMap[radius]};
          padding: ${padding ?? 'var(--spacing-4)'};
          transition: box-shadow 0.15s, transform 0.15s;
        `,
        clickable &&
          css`
            cursor: pointer;
            &:hover {
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
              transform: translateY(-1px);
            }
          `,
      ]}
      {...rest}
    >
      {children}
    </div>
  ),
)

Card.displayName = 'Card'
export default Card
