'use client'

import { useEffect, useState } from 'react'

/** Shared viewport breakpoint — keep in sync with the mobile CSS rules
 *  defined inline on each page (autonomous, map, etc.). */
export const MOBILE_BREAKPOINT = 768

/** True when the viewport is narrow enough to treat the UI as mobile.
 *  Initializes to `false` on the server so SSR markup matches the desktop
 *  layout; effect runs on mount to flip it. */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}
