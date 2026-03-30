import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const QUERIES = {
  desktop: '(min-width: 1025px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
} as const

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.matchMedia(QUERIES.desktop).matches) return 'desktop'
    if (window.matchMedia(QUERIES.tablet).matches) return 'tablet'
    return 'mobile'
  })

  useEffect(() => {
    const desktopMql = window.matchMedia(QUERIES.desktop)
    const tabletMql = window.matchMedia(QUERIES.tablet)

    const update = () => {
      if (desktopMql.matches) setBp('desktop')
      else if (tabletMql.matches) setBp('tablet')
      else setBp('mobile')
    }

    desktopMql.addEventListener('change', update)
    tabletMql.addEventListener('change', update)
    return () => {
      desktopMql.removeEventListener('change', update)
      tabletMql.removeEventListener('change', update)
    }
  }, [])

  return bp
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile'
}

export function useIsDesktop(): boolean {
  return useBreakpoint() === 'desktop'
}
