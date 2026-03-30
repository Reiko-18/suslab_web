/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  title: string
  placement?: Placement
  children: ReactElement
}

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`

const GAP = 8

export default function Tooltip({ title, placement = 'top', children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const calcPos = useCallback(() => {
    const el = triggerRef.current
    const tip = tooltipRef.current
    if (!el || !tip) return
    const r = el.getBoundingClientRect()
    const t = tip.getBoundingClientRect()

    let top = 0
    let left = 0
    switch (placement) {
      case 'top':
        top = r.top - t.height - GAP
        left = r.left + r.width / 2 - t.width / 2
        break
      case 'bottom':
        top = r.bottom + GAP
        left = r.left + r.width / 2 - t.width / 2
        break
      case 'left':
        top = r.top + r.height / 2 - t.height / 2
        left = r.left - t.width - GAP
        break
      case 'right':
        top = r.top + r.height / 2 - t.height / 2
        left = r.right + GAP
        break
    }
    setPos({ top, left })
  }, [placement])

  useEffect(() => {
    if (visible) calcPos()
  }, [visible, calcPos])

  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  if (!isValidElement(children)) return children

  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  })

  return (
    <>
      {child}
      {visible &&
        title &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            css={css`
              position: fixed;
              top: ${pos.top}px;
              left: ${pos.left}px;
              z-index: var(--z-snackbar);
              background: #18191c;
              color: #e0e0e0;
              font-size: 12px;
              padding: 4px 8px;
              border-radius: var(--radius-xs);
              white-space: nowrap;
              pointer-events: none;
              animation: ${fadeIn} 0.15s ease-out;
            `}
          >
            {title}
          </div>,
          document.body,
        )}
    </>
  )
}
